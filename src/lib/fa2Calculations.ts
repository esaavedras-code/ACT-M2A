import { LaborEntry, EquipmentEntry, MaterialEntry } from '../types/fa2';

export const calculateLaborTotal = (entry: LaborEntry) => {
  const regTotal = (entry.hoursReg || 0) * (entry.hourlyRate || 0);
  const ot15Total = (entry.hours15 || 0) * (entry.hourlyRate || 0) * 1.5;
  const ot20Total = (entry.hours20 || 0) * (entry.hourlyRate || 0) * 2.0;
  return regTotal + ot15Total + ot20Total;
};

export const applyAC51Rules = (laborTotal: number, equipmentTotal: number, materialTotal: number) => {
  // 1. Mano de Obra
  const partialMO = laborTotal; // + viajes y dietas (se pueden añadir después)
  const plus20MO = partialMO * 1.20;
  
  // Seguros (Valores de ejemplo, pueden ser configurables)
  const stateInsurance = plus20MO * 0.05; // 5%
  const socialSecurity = plus20MO * 0.062; // 6.2%
  const unemployment = plus20MO * 0.01; // 1%
  const publicLiability = plus20MO * 0.02; // 2%
  const disability = plus20MO * 0.005; // 0.5%
  
  const subtotalMO = plus20MO + stateInsurance + socialSecurity + unemployment + publicLiability + disability;
  const benefitIndustrialMO = subtotalMO * 0.06; // 6% BI Mano de Obra
  const finalMOTotal = subtotalMO + benefitIndustrialMO;

  // 2. Equipo
  const benefitIndustrialEQ = (equipmentTotal || 0) * 0.15; // 15% BI Equipo
  const finalEQTotal = (equipmentTotal || 0) + benefitIndustrialEQ;

  // 3. Materiales
  const benefitIndustrialMAT = (materialTotal || 0) * 0.15; // 15% BI Materiales
  const finalMATTotal = (materialTotal || 0) + benefitIndustrialMAT;

  const grandTotal = finalMOTotal + finalEQTotal + finalMATTotal;

  return {
    labor: { subtotal: laborTotal, plus20: plus20MO, bi: benefitIndustrialMO, total: finalMOTotal },
    equipment: { subtotal: equipmentTotal, bi: benefitIndustrialEQ, total: finalEQTotal },
    materials: { subtotal: materialTotal, bi: benefitIndustrialMAT, total: finalMATTotal },
    grandTotal
  };
};

export const calculateEquipmentRental = (hours: number, dailyRate: number) => {
  // Regla ACT: 8 horas = 1 día.
  // En una versión más avanzada, se compararía con tarifas semanales/mensuales.
  return (hours || 0) * (dailyRate || 0);
};
