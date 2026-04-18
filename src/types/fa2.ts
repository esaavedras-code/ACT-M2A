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
  date?: string;
}

export interface EquipmentEntry {
  id: string;
  description: string;
  model: string;
  year?: string;
  capacity: string;
  fuelType?: 'Gasolina' | 'Diesel' | '';
  ownership?: 'Alquilado' | 'Propio' | '';
  isRented: boolean; 
  hours: number; // Sum total for basic calculations
  hoursActive: number;
  hoursInactive: number;
  hoursRepair: number;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  total?: number;
  date?: string;
  // AC-50 Part B Fields
  aa_rentaMensual?: number;
  cc_factorAnos?: number;
  dd_factorZona?: number;
  ff_horasInactivas?: number;
  kk_costoOperacion?: number;
}

export interface MaterialEntry {
  id: string;
  type: 'M' | 'S' | ''; // Tipo (M) mat. (S) Serv.
  description: string; // Materiales Usados y/o Servicios Prestados
  supplier: string;    // Vendedor
  invoiceNo: string;   // Número de Factura o Conduce
  quantity: number;    // Cantidad
  unitCost?: number;
  amount?: number;     // Amount (Calculated in AC-50/51)
  date?: string;
}

export interface AC49Report {
  id: string;
  projectId: string;
  date: string;
  reportNo: string;
  totalPages: number;
  
  // Partida del contrato vinculada
  relatedItemNo?: string;
  relatedItemDescription?: string;
  relatedItemUnitCost?: number;
  relatedItemAmount?: number;
  relatedEWO?: string;
  startDate?: string;
  endDate?: string;
  photos?: string[];
  groupName?: string; // e.g., "AC-200023- FA1"
  subGroupName?: string; // e.g., "FA1-septiembre"

  labor: LaborEntry[];
  equipment: EquipmentEntry[];
  materials: MaterialEntry[];
  
  laborDetails?: {
    mo_operadores?: number;
    mo_operadores_pct?: number;
    mo_carpinteros?: number;
    mo_carpinteros_pct?: number;
    mo_adicional?: number;
    mo_adicional_pct?: number;
    mo_sin_union_pct?: number;
    mo_gastos_viaje?: number;
    mo_beneficio_ind_pct?: number;
    mo_fondo_estado_pct?: number;
    mo_seguro_social_pct?: number;
    mo_desempleo_est_pct?: number;
    mo_desempleo_fed_pct?: number;
    mo_resp_publica_pct?: number;
    mo_incapacidad_pct?: number;
    mo_beneficio_ind_final_pct?: number;
  };
  
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
