import { Context, HttpRequest } from "@azure/functions"
import axios from "axios";
import _ from "lodash";
import { initMongo } from "../utils/mongodb"

const KMB_API_PATH = "https://data.etabus.gov.hk/v1/transport/kmb"
const BRAVO_API_PATH = "https://rt.data.gov.hk/v1/transport/citybus-nwfb"

export default async function (context: Context, req: HttpRequest): Promise<void> {
    const client = await initMongo();
    const db = client.db("db");

    await Promise.all([
        async () => {
            const collection = db.collection("kmb_route");
            await collection.deleteMany({});
            await collection.insertMany((await axios.get(`${KMB_API_PATH}/route`)).data.data);
        },
        async () => {
            const collection = db.collection("kmb_route_stop");
            await collection.deleteMany({});
            await collection.insertMany((await axios.get(`${KMB_API_PATH}/route-stop`)).data.data);
        },
        async () => {
            const collection = db.collection("kmb_stop");
            await collection.deleteMany({});
            await collection.insertMany((await axios.get(`${KMB_API_PATH}/stop`)).data.data);
        },
    ]);

    const bravoRoutes = [
        ...(await axios.get(`${BRAVO_API_PATH}/route/NWFB`)).data.data,
        ...(await axios.get(`${BRAVO_API_PATH}/route/CTB`)).data.data
    ];
    const bravoRouteCollection = db.collection("bravo_route");
    await bravoRouteCollection.deleteMany({});
    await bravoRouteCollection.insertMany(bravoRoutes);

    const bravoRouteStops = (await Promise.all(bravoRoutes.map(async ({co, route}) => {
        const inbound = (await axios.get(`${BRAVO_API_PATH}/route-stop/${co}/${route}/inbound`)).data.data;
        const outbound = (await axios.get(`${BRAVO_API_PATH}/route-stop/${co}/${route}/outbound`)).data.data;
        return [...inbound, ...outbound]
    }))).flat();
    const bravoRouteStopsCollection = db.collection("bravo_route_stop");
    await bravoRouteStopsCollection.deleteMany({});
    await bravoRouteStopsCollection.insertMany(bravoRouteStops);
    
    const stopIds = _.uniq(bravoRouteStops.map(({stop}) => stop));
    context.log(stopIds);
    const bravoStops = await Promise.all(stopIds.map(async stop => (await axios.get(`${BRAVO_API_PATH}/stop/${stop}`)).data.data));
    const bravoStopsCollection = db.collection("bravo_stop");
    await bravoStopsCollection.deleteMany({});
    await bravoStopsCollection.insertMany(bravoStops);

    const data = await Promise.all((await db.collections()).map(async collection => ({
        collection: collection.collectionName,
        count: await collection.countDocuments()
    })));

    context.log(data);

    context.res = {
        body: data
    }
}
