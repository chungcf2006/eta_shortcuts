import { Context, HttpRequest } from "@azure/functions"
import axios from "axios"
import _ from "lodash"
import moment from "moment"
import { ETA } from "../interface/ETA"
import { Payload } from "../interface/Payload"
import { Stop } from "../interface/Stop"

const KMB_API_PATH = "https://data.etabus.gov.hk/v1/transport/kmb"

export default async function (context: Context, req: HttpRequest): Promise<void> {
    const now = moment();
    const stops = ((await axios.get(`${KMB_API_PATH}/stop`)).data as Payload<Stop[]>).data.filter(({name_tc}) => name_tc === req.query.name);

    if (stops) {
        const etaList = (await Promise.all(stops.map(async stop => {
            const {stop: stopId} = stop;
            const stopEtaList = ((await axios.get(`${KMB_API_PATH}/stop-eta/${stopId}`)).data as Payload<ETA[]>).data;
            
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
                .sort((a, b) => a.eta.valueOf() - b.eta.valueOf())
                .map(eta => `${eta.route} - ${eta.dest_tc}: ${eta.eta_minute}分${eta.rmk_tc?" ("+eta.rmk_tc+")":""}`)
                .join("\n")
        })));
        
        context.res = {
            body: etaList.filter(x => x.length).join("\n=======\n")
        }
    } else {
        context.res = {
            status: 404,
            body: "Stop not Found"
        }
    }
}