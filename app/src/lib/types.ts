export type Role = 'admin' | 'warehouse_staff' | 'technician'

export interface Profile {
  id: string
  full_name: string
  role: Role
  phone: string | null
  is_active: boolean
}

export type AssetStatus =
  | 'in_warehouse'
  | 'deployed'
  | 'in_maintenance'
  | 'in_transit'
  | 'disassembled'
  | 'retired'
  | 'lost_damaged'

export type ConditionGrade = 'new' | 'good' | 'needs_repair' | 'damaged'

export interface Asset {
  id: string
  serial_number: string
  manufacturer_serial_number: string | null
  parent_asset_id: string | null
  asset_model_id: string | null
  asset_type: string
  sensor_subtype: string | null
  model: string | null
  manufacturer: string | null
  purchase_date: string | null
  purchase_cost: number | null
  warranty_expiry: string | null
  current_status: AssetStatus
  current_location_id: string | null
  current_client_id: string | null
  condition_grade: ConditionGrade
  has_battery: boolean
  battery_installed_at: string | null
  battery_expected_life_days: number | null
  battery_last_replaced_at: string | null
  battery_level_pct: number | null
  battery_level_checked_at: string | null
  created_at: string
  updated_at: string
}

export const SENSOR_SUBTYPES = ['temperature', 'gas', 'fridge', 'door', 'humidity', 'other'] as const
export type SensorSubtype = (typeof SENSOR_SUBTYPES)[number]

export interface Client {
  id: string
  client_name: string
  branch_name: string
  branch_address: string | null
  contact_person: string | null
  contact_phone: string | null
  client_sector: string | null
  external_crm_id: string | null
  status: 'active' | 'inactive'
}

export interface Deployment {
  id: string
  asset_id: string
  client_id: string
  contract_reference: string | null
  deployed_at: string
  expected_return_date: string | null
  actual_return_date: string | null
  deployed_by: string
  returned_by: string | null
  return_condition: 'good' | 'needs_repair' | 'damaged' | 'missing' | null
  notes: string | null
}

export interface Component {
  id: string
  component_name: string
  category: string | null
  unit_cost: number
  quantity_on_hand: number
  reorder_threshold: number
  reorder_quantity: number
  preferred_supplier: string | null
  requires_individual_tracking: boolean
}

export interface Consumable {
  id: string
  consumable_name: string
  unit_cost: number
  quantity_on_hand: number
  reorder_threshold: number
}

export interface AssetModel {
  id: string
  model_name: string
  category: string
  preferred_supplier: string | null
  unit_cost: number | null
  lead_time_days: number | null
  reorder_threshold: number
  reorder_quantity: number
}

export type ProductType = 'main_device' | 'sensor_install'

export interface ProductDefinition {
  id: string
  product_name: string
  product_type: ProductType
  default_battery_life_days: number | null
  notes: string | null
}

export type TaskType = 'installation' | 'maintenance' | 'battery_replacement' | 'retrieval' | 'inspection'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface Task {
  id: string
  task_type: TaskType
  branch_id: string
  assigned_to: string
  created_by: string
  scheduled_date: string | null
  status: TaskStatus
  related_product_id: string | null
  related_asset_id: string | null
  checklist: string | null
  completion_notes: string | null
  completed_at: string | null
  created_at: string
}

export interface MaintenanceLog {
  id: string
  asset_id: string
  maintenance_type: string
  performed_at: string
  performed_by: string
  cost: number | null
  notes: string | null
  result: 'passed' | 'failed' | 'needs_parts' | null
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_warehouse: 'بالمستودع',
  deployed: 'عند عميل',
  in_maintenance: 'بالصيانة',
  in_transit: 'بالطريق',
  disassembled: 'مُفكّك',
  retired: 'متقاعد',
  lost_damaged: 'مفقود/تالف',
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  installation: 'تركيب',
  maintenance: 'صيانة',
  battery_replacement: 'استبدال بطارية',
  retrieval: 'استرجاع',
  inspection: 'فحص',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'قيد الانتظار',
  in_progress: 'جارية',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
}
