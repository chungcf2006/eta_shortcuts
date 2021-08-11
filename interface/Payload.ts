export type Payload<V> = {
    type: string;
    version: string;
    generated_timestamp: string;
    data: V;
}