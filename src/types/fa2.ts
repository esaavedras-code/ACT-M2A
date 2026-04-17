export interface Project {
  id: string;
  number: string;
  name: string;
  municipality: string;
  contractor: string;
  itemNumber: string;
  forceAccountNo: string;
}

export interface LaborEntry {
  id: string;
  employeeName: string;
  ssLast4: string;
  classification: string;
  hoursReg: number;
  hours15: number;
  hours20: number;
  hourlyRate: number;
  total?: number;
}

export interface EquipmentEntry {
  id: string;
  description: string;
  model: string;
  capacity: string;
  isRented: boolean;
  hours: number;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  total?: number;
}

export interface MaterialEntry {
  id: string;
  description: string;
  supplier: string;
  invoiceNo: string;
  quantity: number;
  amount: number;
}

export interface AC49Report {
  id: string;
  projectId: string;
  date: string;
  reportNo: string;
  totalPages: number;
  labor: LaborEntry[];
  equipment: EquipmentEntry[];
  materials: MaterialEntry[];
  workDescription: string;
  signatures: {
    contractor: boolean;
    projectChief: boolean;
  };
}

export interface AC51Summary {
  id: string;
  projectId: string;
  period: string;
  laborTotal: number;
  equipmentTotal: number;
  materialsTotal: number;
  margin20: number; // 20% MO
  benefitIndustrialMO: number; // 6%
  benefitIndustrialEQ: number; // 15%
  benefitIndustrialMAT: number; // 15%
  insurances: {
    state: number;
    social: number;
    unemployment: number;
    publicLiability: number;
    disability: number;
  };
  grandTotal: number;
}
