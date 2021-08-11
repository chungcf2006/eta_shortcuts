export type ETA = {
    co: string;
    route: string;
    dir: "I" | "O";
    service_type: string;
    seq: number;
    dest_tc: string;
    dest_sc: string;
    dest_en: string;
    eta_seq: number;
    eta: string;
    rmk_tc: string;
    rmk_sc: string;
    rmk_en: string;
    data_timestamp: string;
}