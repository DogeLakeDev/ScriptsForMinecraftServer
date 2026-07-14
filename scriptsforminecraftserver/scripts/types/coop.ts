export interface CoopMember {
  player_id: string;
  player_name_snapshot: string;
  role: "owner" | "admin" | "member";
  status?: string;
  expires_at?: number | null;
  joined_at: number;
}
export interface CoopData {
  cid: string;
  name: string;
  owner_player_id: string;
  owner_name_snapshot: string;
  status?: string;
  notice?: string;
  fee_bps?: number;
  account?: { cid: string; balance: number; version: number };
  members?: CoopMember[];
  shop_items?: CoopShopItem[];
  created_at: number;
  updated_at: number;
}
export interface CoopShopItem {
  id: string;
  cid: string;
  name: string;
  item_type: string;
  item_aux?: number;
  item_nbt?: string;
  type: number;
  groups?: string;
  des?: string;
  num: number;
  sv: number;
  money: number;
  is_true?: boolean;
  created_at: number;
  updated_at: number;
}
export interface CoopBankLog {
  cid: string;
  actor_id: string;
  actor_name_snapshot: string;
  type: number;
  amount: number;
  note?: string;
  created_at: number;
}
export interface CoopShopGroup {
  groupid: string;
  displayname: string;
  displaydescribe?: string;
  icon?: string;
  type_function?: string;
}
