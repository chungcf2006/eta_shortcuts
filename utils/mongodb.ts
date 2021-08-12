import { MongoClient } from "mongodb";

export let client:MongoClient|null = null;

export async function initMongo() {
    if (!client) {
        client = await new MongoClient(process.env.MONGODB_URL, {
            auth: {
                username: process.env.MONGODB_USER,
                password: process.env.MONGODB_PASSWORD,                
            }
        }).connect();
    }
    return client;
}
