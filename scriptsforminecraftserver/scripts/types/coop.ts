export interface CoopMember {
  player_name: string;
  is_op: boolean;
  joined_at: number;
}
export interface CoopData {
  cid: string;
  name: string;
  owner_name: string;
  notice?: string;
  money?: number;
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
  player_name: string;
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
