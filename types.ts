
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  SLITTING = 'SLITTING',
  CHEMICAL = 'CHEMICAL'
}

export enum DispatchStatus {
  PENDING = 'PENDING',
  PRINTING = 'PRINTING',
  SLITTING = 'SLITTING',
  CUTTING = 'CUTTING',
  COMPLETED = 'COMPLETED',
  DISPATCHED = 'DISPATCHED',
  LOADING = 'LOADING'
}

export interface DispatchSubEntry {
  id: string;
  weight: number;
  pcs: number;
}

export interface DispatchRow {
  id: string;
  planId?: string;
  size: string;
  sizeType?: string;
  micron?: number;
  weight: number;
  pcs: number; 
  bundle: number; 
  status: DispatchStatus; 
  isCompleted: boolean; 
  isLoaded: boolean;    
  productionWeight?: number; 
  wastage?: number;
  subEntries?: DispatchSubEntry[];
}

export interface DispatchEntry {
  id: string;
  dispatchNo: string;
  date: string;
  partyId: string;
  status: DispatchStatus; 
  rows: DispatchRow[];
  totalWeight: number;
  totalPcs: number;
  isTodayDispatch?: boolean; 
  createdAt: string;
  updatedAt: string;
}

export interface ChallanLine {
  id: string;
  size: string;
  sizeType?: string;
  micron?: number; 
  weight: number;
  rate: number; 
  amount: number;
}

export interface Challan {
  id: string;
  challanNumber: string;
  partyId: string;
  date: string;
  lines: ChallanLine[];
  totalWeight: number;
  totalAmount: number;
  paymentMode: PaymentMode;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export enum PaymentMode {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL'
}

export interface ProductionPlan {
  id: string;
  date: string;
  partyName: string;
  size: string;
  type: string;
  printName?: string;
  weight: number;
  micron: number;
  meter: number;
  cuttingSize: number;
  pcs: number;
  notes?: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

export interface PlantProductionPlan {
  id: string;
  date: string;
  partyCode: string;
  sizer: string;
  size: string;
  coils: string[];
  micron: number;
  qty: number;
  meter?: number;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

export interface SlittingProductionRow {
  id: string;
  coilId: string;
  srNo: number;
  size: string;
  meter: number;
  micron: number;
  grossWeight: number;
  coreWeight: number;
  netWeight: number;
}

export interface SlittingCoil {
  id: string;
  number: number;
  size: string;
  rolls: number;
  producedBundles?: number;
  targetQty?: number; // Added to support per-coil planning
}

export interface SlittingJob {
  id: string;
  date: string;
  jobNo: string;
  jobCode: string;
  
  // Industrial Card Metadata
  mcNo?: string;
  winding?: string;
  coreId?: string;
  coreThickness?: string;
  packingType?: string;
  dispatchDate?: string;

  coils: SlittingCoil[];
  planMicron: number;
  planQty: number;
  planRollLength: number;
  planSizer?: number; // Added field to persist sizer/tube width
  
  rows: SlittingProductionRow[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
}

export type ChemicalPlant = '65mm' | '45mm' | 'Jumbo';

export interface ChemicalLog {
  id: string;
  date: string;
  plant: ChemicalPlant;
  dop: number;
  stabilizer: number;
  epoxy: number;
  g161?: number;
  nbs: number;
  createdAt: string;
}

export interface ChemicalStock {
  dop: number;
  stabilizer: number;
  epoxy: number;
  g161: number;
  nbs: number;
}

export interface ChemicalPurchase {
  id: string;
  date: string;
  chemical: keyof ChemicalStock;
  quantity: number;
  createdAt: string;
}

export interface Party {
  id: string;
  name: string;
  code?: string;
  contact: string;
  address: string;
}

export interface AppData {
  parties: Party[];
  dispatches: DispatchEntry[];
  challans: Challan[];
  slittingJobs: SlittingJob[];
  productionPlans: ProductionPlan[];
  plantProductionPlans: PlantProductionPlan[];
  chemicalLogs: ChemicalLog[];
  chemicalStock: ChemicalStock;
  chemicalPurchases: ChemicalPurchase[];
  settings?: {
      googleSheetUrl?: string;
  };
}