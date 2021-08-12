import { Context, HttpRequest } from "@azure/functions"
import axios from "axios"
import moment from "moment"
import { ETA } from "../interface/ETA"
import { Payload } from "../interface/Payload"
import { Stop } from "../interface/Stop"
import { client, initMongo } from "../utils/mongodb"

const KMB_API_PATH = "https://data.etabus.gov.hk/v1/transport/kmb"
const BRAVO_API_PATH = "https://rt.data.gov.hk/v1/transport/citybus-nwfb"

export default async function (context: Context, req: HttpRequest): Promise<void> {
    const now = moment();
    await initMongo();
    const kmbStops:Stop[] = await client.db("db").collection("kmb_stop").find({ name_tc: req.query.name }).toArray();
    const bravoStops:Stop[] = await client.db("db").collection("bravo_stop").find({ name_tc: {$regex: `^${req.query.name}`}}).toArray();

    if (kmbStops.length > 0 || bravoStops.length > 0) {
        const etaList = (await Promise.all([
            Promise.all(kmbStops.map(async ({stop}) => ((await axios.get(`${KMB_API_PATH}/stop-eta/${stop}`)).data as Payload<ETA[]>).data)),
            Promise.all(bravoStops.map(async bravoStop => {
                const routeStops = await client.db("db").collection("bravo_route_stop").find({ stop: bravoStop.stop }).toArray();
                return (await Promise.all(routeStops.map(async ({co, stop, route}) => ((await axios.get(`${BRAVO_API_PATH}/eta/${co}/${stop}/${route}`)).data as Payload<ETA[]>).data))).flat()
            }))
        ]))
        .flat()
        .map(stopEtaList => {
            return stopEtaList
                .filter(eta => eta.eta)
                .map(eta => {
                    const etaMoment = moment(eta.eta);
                    const etaDiff = etaMoment.diff(now, "minute");
                    return {
                        ...eta,
                        eta: etaMoment,
                        eta_minute: Math.max(etaDiff, 0)
                    }
                })
                .sort((a, b) => a.eta_seq - b.eta_seq)
                .sort((a, b) => a.seq - b.seq)
                .sort((a, b) => a.route.localeCompare(b.route))
                .map(eta => `${eta.route} - ${eta.dest_tc}: ${eta.eta_minute}分${eta.rmk_tc?" ("+eta.rmk_tc+")":""}`)
                .join("\n")
        });
        
        context.res = {
            body: etaList.filter(eta => eta.length).join("\n=======\n")
        }
    } else {
        context.res = {
            status: 404,
            body: "Stop not Found"
        }
    }
}