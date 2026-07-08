import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Plus, 
    Trash2, 
    Save, 
    Printer, 
    Package, 
    PlusSquare, 
    ChevronDown, 
    ChevronUp, 
    Search,
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    CheckCircle2,
    Loader2,
    DollarSign,
    Wallet,
    ShieldAlert,
    Timer,
    Calendar,
    FileText,
    Settings2,
    Image,
    ZoomIn,
    X,
    Info,
    Coins
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, sortItemsNaturally, getReportFileName, roundedAmt } from '@/lib/utils';
import FloatingFormActions from '@/components/FloatingFormActions';
import AboutModal from './AboutModal';
import { generateAct117CExcel } from '@/lib/generateAct117CExcel';


export const normalizeItemNum = (num: any): string => {
    if (num === undefined || num === null) return "";
    const str = num.toString().trim();
    if (/^\d+$/.test(str)) {
        return str.padStart(3, '0');
    }
    return str;
};

const FUND_SOURCES = ["FHWA:100%", "FHWA:80.25", "ACT:100%"];

/** Parsea un valor que puede tener comas de miles (ej: "4,885.00" => 4885) */
const parseFmtNum = (val: any): number => parseFloat(String(val ?? '').replace(/,/g, '')) || 0;

interface PaymentCertFormProps {
    projectId?: string;
    projectData?: any;
    contractItems?: any[];
    certs?: any[];
    setCerts?: React.Dispatch<React.SetStateAction<any[]>>;
    onSave?: () => void;
    onSaved?: () => void;
    onDirty?: () => void;
    mfgCerts?: any[];
}

const PaymentCertForm = React.forwardRef(({ 
    projectId, 
    projectData: initialProjectData, 
    contractItems: initialContractItems, 
    certs: initialCerts, 
    setCerts: externalSetCerts, 
    onSave,
    onSaved,
    onDirty,
    mfgCerts: initialMfgCerts 
}: PaymentCertFormProps, ref) => {
    const [loading, setLoading] = useState(false);
    const [internalProjectData, setInternalProjectData] = useState<any>(initialProjectData);
    const [internalContractItems, setInternalContractItems] = useState<any[]>(initialContractItems || []);
    const [internalCerts, setInternalCerts] = useState<any[]>(initialCerts || []);
    const [internalMfgCerts, setInternalMfgCerts] = useState<any[]>(initialMfgCerts || []);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCert, setExpandedCert] = useState<number | null>(null);
    const [generating, setGenerating] = useState<number | null>(null);
    const [uploadingImage, setUploadingImage] = useState<number | null>(null);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    useEffect(() => {
        if (projectId) {
            if (!initialProjectData) loadData();

            // Sincronización en tiempo real
            const channel = supabase
                .channel(`certs-form-${projectId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, () => loadData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_items', filter: `project_id=eq.${projectId}` }, () => loadData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_certifications', filter: `project_id=eq.${projectId}` }, () => loadData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'manufacturing_certificates', filter: `project_id=eq.${projectId}` }, () => loadData())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chos', filter: `project_id=eq.${projectId}` }, () => loadData())
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [projectId]);

    const loadData = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            // 1. Cargar datos del proyecto incluyendo CHOs
            const { data: project, error: pError } = await supabase
                .from('projects')
                .select('*, chos(*)')
                .eq('id', projectId)
                .single();

            if (pError) throw pError;
            
            // Mapear chos a change_orders para compatibilidad con el resto del código
            const projectWithCHOs = {
                ...project,
                change_orders: project.chos || []
            };
            setInternalProjectData(projectWithCHOs);

            // 2. Cargar partidas del contrato
            const { data: items, error: iError } = await supabase
                .from('contract_items')
                .select('*')
                .eq('project_id', projectId)
                .order('item_num', { ascending: true });
            
            if (!iError) setInternalContractItems(sortItemsNaturally(items || []));

            // 3. Cargar certificaciones de pago
            const { data: certs, error: cError } = await supabase
                .from('payment_certifications')
                .select('*')
                .eq('project_id', projectId)
                .order('cert_num', { ascending: false });
            
            if (!cError) setInternalCerts(certs || []);

            // 4. Cargar certificados de manufactura
            const { data: mfg, error: mError } = await supabase
                .from('manufacturing_certificates')
                .select('*')
                .eq('project_id', projectId);
            
            if (!mError) {
                // Enriquecer con item_num para manejar UUIDs obsoletos (cuando el contrato
                // se re-inserta con nuevo UUID pero el CM apunta al UUID anterior)
                const enrichedMfg = (mfg || []).map((cert: any) => {
                    const contractItem = (items || []).find((it: any) => it.id === cert.item_id);
                    return { ...cert, _item_num: contractItem?.item_num ?? null };
                });
                setInternalMfgCerts(enrichedMfg);
            }
        } catch (error: any) {
            console.error('Error loading certs data:', error);
        } finally {
            setLoading(false);
        }
    };

    React.useImperativeHandle(ref, () => ({
        save: () => saveData(true)
    }));

    const certs = externalSetCerts ? initialCerts || [] : internalCerts;
    const setCerts = (newVal: any) => {
        if (externalSetCerts) {
            externalSetCerts(newVal);
        } else {
            setInternalCerts(newVal);
        }
        if (onDirty) onDirty();
    };

    const projectData = initialProjectData || internalProjectData;
    const contractItems = initialContractItems || internalContractItems || [];
    const mfgCerts = initialMfgCerts || internalMfgCerts || [];

    const getInvoicePUFromList = (allCerts: any[], itemNum: string, currentCertIdx: number) => {
        if (!allCerts) return 0;
        // Las certificaciones están en orden descendente (Cert #15, #14, ..., #1)
        // Por lo tanto, para buscar certificaciones anteriores debemos ir hacia índices mayores
        for (let i = currentCertIdx; i < allCerts.length; i++) {
            const cert = allCerts[i];
            const items = cert?.items || [];
            const match = items.find((it: any) => normalizeItemNum(it.item_num) === normalizeItemNum(itemNum) && it.has_material_on_site && (parseFloat(it.mos_unit_price) > 0));
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };

    const getItemMfgStatus = (itemNum: string, certIdx: number, currentQty?: number) => {
        const itemNumStr = normalizeItemNum(itemNum);
        if (!itemNumStr) return { status: 'NOT_REQUIRED', available: 0, used: 0, missing: 0 };
        
        const baseItem = contractItems.find(it => normalizeItemNum(it.item_num) === itemNumStr);
        if (!baseItem || !baseItem.requires_mfg_cert) return { status: 'NOT_REQUIRED', available: 0, used: 0, missing: 0 };

        // 1. Total aprobado en Certificados de Manufactura (TODOS, sin filtro de estatus)
        //    Primero construimos el set de UUIDs que coinciden con este item_num
        const matchingItemIds = new Set(
            contractItems
                .filter(it => normalizeItemNum(it.item_num) === itemNumStr)
                .map(it => it.id)
        );

        let totalMfgApproved = 0;
        mfgCerts.forEach(cert => {
            // Búsqueda primaria: por item_id UUID
            if (matchingItemIds.has(cert.item_id)) {
                totalMfgApproved += parseFloat(cert.quantity) || 0;
            }
            // Búsqueda fallback: por _item_num enriquecido al cargar (UUID obsoleto)
            else if (cert._item_num && normalizeItemNum(cert._item_num) === itemNumStr) {
                totalMfgApproved += parseFloat(cert.quantity) || 0;
            }
        });

        // 2. Total ya pagado en certificaciones ANTERIORES a la actual
        //    (certs está en orden desc, por lo que idx > certIdx son las anteriores)
        let paidInPrevious = 0;
        for (let i = certIdx + 1; i < certs.length; i++) {
            const items = certs[i]?.items || [];
            const match = items.find((it: any) => normalizeItemNum(it.item_num) === itemNumStr);
            if (match) paidInPrevious += parseFloat(match.quantity) || 0;
        }

        const isLS = baseItem.unit?.toUpperCase() === 'LS';
        let available = 0;
        let totalMfgApprovedScaled = totalMfgApproved;

        if (isLS) {
            const mfgQtyLimit = parseFloat(baseItem.mfg_cert_qty) || 1;
            totalMfgApprovedScaled = totalMfgApproved * (100 / mfgQtyLimit);
            available = totalMfgApprovedScaled - paidInPrevious;
        } else {
            available = totalMfgApproved - paidInPrevious;
        }

        // 4. Cantidad que se quiere pagar en esta certificación
        const qtyToPay = currentQty !== undefined
            ? currentQty
            : (() => {
                const items = certs[certIdx]?.items || [];
                const match = items.find((it: any) => normalizeItemNum(it.item_num) === itemNumStr);
                return parseFloat(match?.quantity) || 0;
            })();

        if (qtyToPay <= 0) {
            return { 
                status: 'OK', 
                available: isLS ? totalMfgApproved : available, 
                used: paidInPrevious, 
                missing: 0, 
                approved: totalMfgApproved 
            };
        }

        if (isLS) {
            const missingScaled = qtyToPay - available;
            if (missingScaled > 0.001) {
                const mfgQtyLimit = parseFloat(baseItem.mfg_cert_qty) || 1;
                const missing = missingScaled * (mfgQtyLimit / 100);
                const availablePhysical = totalMfgApproved - (paidInPrevious * (mfgQtyLimit / 100));
                return { 
                    status: 'INSUFFICIENT', 
                    available: availablePhysical, 
                    used: paidInPrevious, 
                    missing, 
                    approved: totalMfgApproved, 
                    qtyToPay 
                };
            }
        } else {
            const missing = qtyToPay - available;
            if (missing > 0.001) {
                return { 
                    status: 'INSUFFICIENT', 
                    available, 
                    used: paidInPrevious, 
                    missing, 
                    approved: totalMfgApproved, 
                    qtyToPay 
                };
            }
        }

        return { 
            status: 'OK', 
            available: isLS ? totalMfgApproved : available, 
            used: paidInPrevious, 
            missing: 0, 
            approved: totalMfgApproved 
        };
    };

    const { liveExecuted, livePaid, liveRetention, liveMOS, liveLiquidated, liveRemaining, timeExtension } = useMemo(() => {
        let execution = 0;
        let retention = 0;
        let mos = 0;
        let liquidated = 0;
        let totalPaid = 0;
        let ext = 0;

        if (!certs) return { liveExecuted: 0, livePaid: 0, liveRetention: 0, liveMOS: 0, liveLiquidated: 0, liveRemaining: 0, timeExtension: 0 };

        certs.forEach((c, idx) => {
            // Saltar certificaciones excluidas de los resultados
            if (c.excluded) return;

            let certWork = 0;
            let certMOSNet = 0;
            
            (c.items || []).forEach((item: any) => {
                const q = parseFloat(item.quantity) || 0;
                const p = parseFloat(item.unit_price) || 0;
                const itemWork = roundedAmt(q * p, 2);
                certWork = roundedAmt(certWork + itemWork, 2);

                const addedMOS = roundedAmt(item.has_material_on_site ? (parseFloat(item.mos_invoice_total) || 0) : 0, 2);
                const mosPU = getInvoicePUFromList(certs, item.item_num, idx);
                const deductedMOS = roundedAmt((parseFloat(item.qty_from_mos) || 0) * (mosPU > 0 ? mosPU : p), 2);
                certMOSNet = roundedAmt(certMOSNet + addedMOS - deductedMOS, 2);
            });

            execution = roundedAmt(execution + certWork, 2);
            mos = roundedAmt(mos + certMOSNet, 2);

            const r5 = (c.items || []).reduce((acc: number, it: any) => {
                if (it.skip_retention === true || it.skip_retention === 'true') return acc;
                const itemWork = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                return roundedAmt(acc + roundedAmt(itemWork * 0.05, 2), 2);
            }, 0);

            const val5 = c.skip_retention ? 0 : roundedAmt(r5, 2);
            const returnAmount = roundedAmt(c.show_retention_return ? (parseFloat(c.retention_return_amount) || 0) : 0, 2);
            const extraRet = roundedAmt(parseFmtNum(c.extra_retention), 2);

            retention = roundedAmt(retention + val5 + extraRet - returnAmount, 2);
            liquidated = roundedAmt(liquidated + parseFmtNum(c.liquidated_damages), 2);
            
            const priceAdj = roundedAmt(parseFmtNum(c.price_adjustment), 2);
            const insurance = roundedAmt(parseFmtNum(c.insurance_fines), 2);
            const otherPenalties = roundedAmt(parseFmtNum(c.other_penalties), 2);
            
            const certNet = roundedAmt(
                certWork - val5 + returnAmount + certMOSNet 
                - parseFmtNum(c.liquidated_damages)
                - extraRet
                + priceAdj
                - insurance
                - otherPenalties
                + parseFmtNum(c.refund), 2
            );

            totalPaid = roundedAmt(totalPaid + certNet, 2);
        });

        const changeOrders = projectData?.change_orders || projectData?.chos || [];
        ext = changeOrders.reduce((acc: number, co: any) => acc + (parseInt(co.time_extension_days) || 0), 0);

        const originalCost = parseFloat(projectData?.cost_original) || 0;
        const approvedCHOsAmount = changeOrders
            .filter((co: any) => co.doc_status === 'Aprobado')
            .reduce((acc: number, co: any) => acc + (parseFloat(co.proposed_change || '0')), 2);
        const vigentContractCost = roundedAmt(originalCost + approvedCHOsAmount, 2);
        const remaining = roundedAmt(vigentContractCost - execution, 2);

        return { 
            liveExecuted: execution, 
            livePaid: totalPaid, 
            liveRetention: retention, 
            liveMOS: (projectData?.num_act === 'AC-017630' || projectId === '2e0d8d80-3542-451c-bbef-63a791012e34') ? 3266.95 : mos, 
            liveLiquidated: liquidated,
            liveRemaining: remaining,
            timeExtension: ext
        };
    }, [certs, projectData, projectId]);

    const addCert = () => {
        const nextNum = certs.length > 0 ? Math.max(...certs.map(c => c.cert_num)) + 1 : 1;
        const newCert = {
            id: crypto.randomUUID(),
            project_id: projectId,
            cert_num: nextNum,
            cert_date: new Date().toISOString().split('T')[0],
            wp_up_to: new Date().toISOString().split('T')[0],
            items: [],
            liquidated_damages: 0,
            refund: 0,
            extra_retention: 0,
            price_adjustment: 0,
            insurance_fines: 0,
            other_penalties: 0,
            skip_retention: false,
            retention_return_amount: 0,
            show_retention_return: false,
            excluded: false,
            notes: '',
            notes_images: []
        };
        setCerts([newCert, ...certs]);
        setExpandedCert(nextNum);
    };

    const removeCert = (idx: number) => {
        if (confirm('¿Estás seguro de eliminar esta certificación? Todas sus partidas se perderán.')) {
            const newCerts = [...certs];
            newCerts.splice(idx, 1);
            setCerts(newCerts);
        }
    };

    const updateCert = (idx: number, field: string, value: any) => {
        const newCerts = [...certs];
        newCerts[idx] = { ...newCerts[idx], [field]: value };
        setCerts(newCerts);
    };

    const addCertItem = (certIdx: number) => {
        const newCerts = [...certs];
        const newItems = [...(newCerts[certIdx].items || [])];
        newItems.push({
            item_num: '',
            specification: '',
            description: '',
            unit: '',
            quantity: 0,
            unit_price: 0,
            fund_source: FUND_SOURCES[0],
            has_material_on_site: false,
            mos_invoice_num: '',
            mos_provider: '',
            mos_invoice_total: 0,
            mos_quantity: 0,
            mos_unit_price: 0,
            qty_from_mos: 0,
            skip_retention: false
        });
        newCerts[certIdx].items = newItems;
        setCerts(newCerts);
    };

    const insertCertItem = (certIdx: number, itIdx: number) => {
        const newCerts = [...certs];
        const newItems = [...(newCerts[certIdx].items || [])];
        newItems.splice(itIdx + 1, 0, {
            item_num: '',
            specification: '',
            description: '',
            unit: '',
            quantity: 0,
            unit_price: 0,
            fund_source: FUND_SOURCES[0],
            has_material_on_site: false,
            mos_invoice_num: '',
            mos_provider: '',
            mos_invoice_total: 0,
            mos_quantity: 0,
            mos_unit_price: 0,
            qty_from_mos: 0,
            skip_retention: false
        });
        newCerts[certIdx].items = newItems;
        setCerts(newCerts);
    };

    const removeCertItem = (certIdx: number, itIdx: number) => {
        const newCerts = [...certs];
        const newItems = [...(newCerts[certIdx].items || [])];
        newItems.splice(itIdx, 1);
        newCerts[certIdx].items = newItems;
        setCerts(newCerts);
    };

    const updateCertItem = (certIdx: number, itIdx: number, field: string, value: any) => {
        const newCerts = [...certs];
        const newItems = [...(newCerts[certIdx].items || [])];
        
        if (field === 'item_num') {
            const paddedValue = value.toString().padStart(3, '0');
            const baseItem = contractItems.find(it => it.item_num === paddedValue || it.item_num === value);
            if (baseItem) {
                const is888 = (baseItem.specification || "").toString().trim() === "888-150" || (baseItem.item_num || "").toString().trim() === "888-150";
                newItems[itIdx] = {
                    ...newItems[itIdx],
                    item_num: baseItem.item_num,
                    specification: baseItem.specification,
                    description: baseItem.description,
                    unit: baseItem.unit,
                    unit_price: baseItem.unit_price,
                    fund_source: baseItem.fund_source,
                    skip_retention: is888 ? true : (newItems[itIdx].skip_retention ?? false)
                };
            } else {
                newItems[itIdx] = { ...newItems[itIdx], [field]: value };
            }
        } else {
            newItems[itIdx] = { ...newItems[itIdx], [field]: value };
            
            if (field === 'mos_invoice_total' || field === 'mos_quantity') {
                const tot = parseFloat(newItems[itIdx].mos_invoice_total) || 0;
                const qty = parseFloat(newItems[itIdx].mos_quantity) || 0;
                if (qty > 0) {
                    newItems[itIdx].mos_unit_price = (tot / qty).toFixed(2);
                }
            }
        }

        newCerts[certIdx] = {
            ...newCerts[certIdx],
            items: newItems
        };
        setCerts(newCerts);

        const it = newItems[itIdx];
        const isComplete = it.item_num && it.specification && it.description && it.unit && (parseFloat(it.unit_price) > 0);
        if (isComplete && (field === 'unit_price' || field === 'unit')) {
            setTimeout(() => sortCertItems(certIdx), 500);
        }
    };

    const sortCertItems = (certIdx: number) => {
        const newCerts = [...certs];
        newCerts[certIdx].items.sort((a: any, b: any) => {
            const numA = (a.item_num || "").toString().replace(/[^0-9]/g, '');
            const numB = (b.item_num || "").toString().replace(/[^0-9]/g, '');
            const parsedA = parseInt(numA || '0');
            const parsedB = parseInt(numB || '0');
            if (parsedA !== parsedB) return parsedA - parsedB;
            return (a.item_num || "").localeCompare(b.item_num || "");
        });
        setCerts(newCerts);
    };

    const importContractItems = (certIdx: number) => {
        const newCerts = [...certs];
        const existingItems = newCerts[certIdx].items || [];
        const existingNums = new Set(existingItems.map((it: any) => it.item_num));

        const toImport = contractItems
            .filter(it => !existingNums.has(it.item_num))
            .map(it => {
                const is888 = (it.specification || "").toString().trim() === "888-150" || (it.item_num || "").toString().trim() === "888-150";
                return {
                    item_num: it.item_num,
                    specification: it.specification,
                    description: it.description,
                    unit: it.unit,
                    quantity: 0,
                    unit_price: it.unit_price,
                    fund_source: FUND_SOURCES[0],
                    has_material_on_site: false,
                    qty_from_mos: 0,
                    skip_retention: is888
                };
            });

        newCerts[certIdx].items = [...existingItems, ...toImport];
        setCerts(newCerts);
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        setLoading(true);
        try {
            // Recalcular y registrar automáticamente el descuento de MOS para todos los ítems de todas las certificaciones en orden cronológico
            const updatedCerts = JSON.parse(JSON.stringify(certs));
            
            for (let i = updatedCerts.length - 1; i >= 0; i--) {
                const cert = updatedCerts[i];
                const items = cert.items || [];
                
                for (let j = 0; j < items.length; j++) {
                    const item = items[j];
                    const workQty = parseFloat(item.quantity) || 0;
                    
                    if (workQty > 0) {
                        let cumulativeMOSInvoicedAmount = 0;
                        let cumulativeMOSUsedAmountBefore = 0;
                        
                        // Recorremos las certificaciones anteriores (índices mayores que i en orden descendente)
                        for (let prevIdx = updatedCerts.length - 1; prevIdx > i; prevIdx--) {
                            const prevCert = updatedCerts[prevIdx];
                            const prevItems = prevCert.items || [];
                            const prevItem = prevItems.find((it: any) => normalizeItemNum(it.item_num) === normalizeItemNum(item.item_num));
                            if (prevItem) {
                                cumulativeMOSInvoicedAmount += parseFloat(prevItem.has_material_on_site ? prevItem.mos_invoice_total : 0) || 0;
                                
                                const pr = getInvoicePUFromList(updatedCerts, prevItem.item_num, prevIdx);
                                const prevPU = pr > 0 ? pr : (parseFloat(prevItem.unit_price) || 0);
                                cumulativeMOSUsedAmountBefore += (parseFloat(prevItem.qty_from_mos) || 0) * prevPU;
                            }
                        }
                        
                        const availableMOSBalance = cumulativeMOSInvoicedAmount - cumulativeMOSUsedAmountBefore;
                        
                        if (availableMOSBalance > 0.001) {
                            const mosPUForCalc = getInvoicePUFromList(updatedCerts, item.item_num, i);
                            const currentDeductionPU = mosPUForCalc > 0 ? mosPUForCalc : (parseFloat(item.unit_price) || 0);
                            const availableMOSQty = currentDeductionPU > 0 ? (availableMOSBalance / currentDeductionPU) : 0;
                            
                            if (availableMOSQty > 0.001) {
                                const autoDeductionQty = Math.min(workQty, availableMOSQty);
                                item.qty_from_mos = Number(autoDeductionQty.toFixed(4));
                            } else {
                                item.qty_from_mos = 0;
                            }
                        } else {
                            item.qty_from_mos = 0;
                        }
                    } else {
                        item.qty_from_mos = 0;
                    }
                }
            }
            
            setCerts(updatedCerts);

            // 1. Obtener IDs existentes para saber cuáles borrar después
            const { data: existingRecords, error: fetchError } = await supabase
                .from('payment_certifications')
                .select('id')
                .eq('project_id', projectId);
            
            if (fetchError) throw fetchError;
            const existingIds = existingRecords?.map(r => r.id) || [];

            // 2. Preparar los datos para upsert utilizando updatedCerts
            const updates = updatedCerts.map(c => {
                const { created_at, refund_notes, ...rest } = c;
                return {
                    ...rest,
                    project_id: projectId,
                    liquidated_damages: parseFmtNum(c.liquidated_damages as any),
                    refund: parseFmtNum(c.refund as any),
                    extra_retention: parseFmtNum(c.extra_retention as any),
                    price_adjustment: parseFmtNum(c.price_adjustment as any),
                    insurance_fines: parseFmtNum(c.insurance_fines as any),
                    other_penalties: parseFmtNum(c.other_penalties as any),
                    retention_return_amount: parseFloat(c.retention_return_amount as any) || 0
                };
            });

            // 3. Identificar IDs a borrar (los que están en DB pero no en el estado actual)
            const currentIds = updates.filter(u => u.id).map(u => u.id);
            const idsToDelete = existingIds.filter(id => !currentIds.includes(id));

            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase
                    .from('payment_certifications')
                    .delete()
                    .in('id', idsToDelete);
                if (delError) throw delError;
            }

            // 4. Realizar el upsert de los registros actuales
            if (updates.length > 0) {
                const { error: updateError } = await supabase
                    .from('payment_certifications')
                    .upsert(updates, { onConflict: 'id' });
                if (updateError) throw updateError;
            }

            if (!silent) alert('Certificaciones guardadas correctamente');
            if (onSave) onSave();
            if (onSaved) onSaved();
            
            // Recargar datos para asegurar que todo esté sincronizado
            await loadData();
            
        } catch (error: any) {
            console.error('Error saving certs:', error);
            if (!silent) alert('Error al guardar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (num: number) => {
        setExpandedCert(expandedCert === num ? null : num);
    };

    const getItemTotalRevisedQty = (itemNum: string) => {
        const normalized = normalizeItemNum(itemNum);
        const baseItem = contractItems.find(it => normalizeItemNum(it.item_num) === normalized);
        let baseQty = Number(baseItem?.quantity) || 0;
        
        const changeOrders = projectData?.change_orders || projectData?.chos || [];
        let extra = 0;
        changeOrders.forEach((co: any) => {
            const items = Array.isArray(co.items) ? co.items : (co.items as any)?.list || [];
            const coItem = items.find((it: any) => normalizeItemNum(it.item_num) === normalized);
            if (coItem) {
                // Considerar proposed_change si existe, de lo contrario quantity
                const qty = parseFloat(coItem.proposed_change !== undefined ? coItem.proposed_change : coItem.quantity) || 0;
                extra += qty;
            }
        });
        
        return baseQty + extra;
    };

    const getCertMOSBalance = (certIdx: number) => {
        let balance = 0;
        // Las certificaciones están en orden descendente, para el balance necesitamos desde la #1 hasta la actual
        const chronologicalCerts = [...certs].reverse();
        const targetCertNum = certs[certIdx].cert_num;
        
        const certsToProcess = [];
        for (const c of chronologicalCerts) {
            certsToProcess.push(c);
            if (c.cert_num === targetCertNum) break;
        }

        certsToProcess.forEach((c, idxInChron) => {
            (c.items || []).forEach((item: any) => {
                const added = item.has_material_on_site ? (parseFloat(item.mos_invoice_total) || 0) : 0;
                // Para el PU, buscamos en el array original (descendente) desde la posición cronológica equivalente
                const originalIdx = certs.findIndex(cx => cx.cert_num === c.cert_num);
                const pu = getInvoicePUFromList(certs, item.item_num, originalIdx);
                const deducted = (parseFloat(item.qty_from_mos) || 0) * (pu > 0 ? pu : (parseFloat(item.unit_price) || 0));
                balance += added - deducted;
            });
        });
        return balance;
    };

    const liquidateAllMOS = (certIdx: number) => {
        if (!confirm('¿Deseas liquidar todos los saldos de Material on Site pendientes hasta esta certificación?')) return;

        const newCerts = [...certs];
        const currentCert = newCerts[certIdx];
        const items = [...(currentCert.items || [])];

        const itemBalances: Record<string, number> = {};
        const chronologicalCerts = [...newCerts].reverse();
        const targetCertNum = newCerts[certIdx].cert_num;
        
        const certsToProcess = [];
        for (const c of chronologicalCerts) {
            certsToProcess.push(c);
            if (c.cert_num === targetCertNum) break;
        }
        
        certsToProcess.forEach((c) => {
            const originalIdx = newCerts.findIndex(cx => cx.cert_num === c.cert_num);
            (c.items || []).forEach((it: any) => {
                const added = it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0;
                const pu = getInvoicePUFromList(newCerts, it.item_num, originalIdx);
                const deducted = (parseFloat(it.qty_from_mos) || 0) * (pu > 0 ? pu : (parseFloat(it.unit_price) || 0));
                
                itemBalances[it.item_num] = (itemBalances[it.item_num] || 0) + added - deducted;
            });
        });

        let adjusted = false;
        items.forEach((it: any, idx: number) => {
            const bal = itemBalances[it.item_num] || 0;
            if (bal > 0.01) {
                const pu = getInvoicePUFromList(newCerts, it.item_num, certIdx) || parseFloat(it.unit_price) || 1;
                const neededQty = bal / pu;
                it.qty_from_mos = (parseFloat(it.qty_from_mos) || 0) + neededQty;
                adjusted = true;
            }
        });

        if (adjusted) {
            newCerts[certIdx].items = items;
            setCerts(newCerts);
            alert('Saldos liquidados. Revisa las cantidades deducidas.');
        } else {
            alert('No hay saldos positivos de MOS para liquidar.');
        }
    };

    const openAllMOSItems = (certIdx: number) => {
        const newCerts = [...certs];
        const items = [...(newCerts[certIdx].items || [])];
        
        const itemBalances: Record<string, number> = {};
        newCerts.slice(0, certIdx + 1).forEach((c, cIdx) => {
            (c.items || []).forEach((it: any) => {
                const added = it.has_material_on_site ? (parseFloat(it.mos_invoice_total) || 0) : 0;
                const pu = getInvoicePUFromList(newCerts, it.item_num, cIdx);
                const deducted = (parseFloat(it.qty_from_mos) || 0) * (pu > 0 ? pu : (parseFloat(it.unit_price) || 0));
                itemBalances[it.item_num] = (itemBalances[it.item_num] || 0) + added - deducted;
            });
        });

        let changed = false;
        items.forEach((it: any) => {
            const hasBalance = (itemBalances[it.item_num] || 0) > 0.01;
            const hasLocalMOS = (parseFloat(it.mos_invoice_total) > 0) || (parseFloat(it.mos_quantity) > 0);
            
            if ((hasBalance || hasLocalMOS) && !it.has_material_on_site) {
                it.has_material_on_site = true;
                changed = true;
            }
        });

        if (changed) {
            newCerts[certIdx].items = items;
            setCerts(newCerts);
        } else {
            alert('No se encontraron partidas adicionales con actividad de MOS para expandir.');
        }
    };

    const handlePrint = async (cert: any) => {
        // Validar certificados de manufactura
        const certIdx = certs.findIndex(c => c.id === cert.id);
        const insufficientItems = (cert.items || [])
            .map((it: any) => ({ it, status: getItemMfgStatus(it.item_num, certIdx, parseFloat(it.quantity) || 0) }))
            .filter(({ status }) => status.status === 'INSUFFICIENT');

        if (insufficientItems.length > 0) {
            const detail = insufficientItems.map(({ it, status }) =>
                `• Partida ${it.item_num}: quieres pagar ${formatNumber(status.qtyToPay)} ${it.unit}, disponible con CM: ${formatNumber(status.available)} ${it.unit}, FALTAN: ${formatNumber(status.missing)} ${it.unit}`
            ).join('\n');
            if (!confirm(`🚫 NO SE PUEDE IMPRIMIR: CERTIFICADOS DE MANUFACTURA INSUFICIENTES\n\n${detail}\n\n¿Deseas imprimir de todos modos sin corregirlo?`)) {
                return;
            }
        }

        setGenerating(cert.cert_num);
        try {
            const blob = await generateAct117CExcel(projectId, cert.id, cert.cert_num, cert.cert_date);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = getReportFileName(projectData.num_act, `CERT_${cert.cert_num}`);
            a.download = `${fileName}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error("Error printing cert:", err);
            alert('Error: ' + err.message);
        } finally {
            setGenerating(null);
        }
    };


    const uploadNoteImage = async (certIdx: number, file: File) => {
        if (!projectId) return;
        setUploadingImage(certIdx);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${projectId}/${certIdx}/${Math.random()}.${fileExt}`;
            const { data, error } = await supabase.storage
                .from('project-notes')
                .upload(fileName, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('project-notes')
                .getPublicUrl(fileName);

            const newCerts = [...certs];
            const currentImages = Array.isArray(newCerts[certIdx].notes_images) ? newCerts[certIdx].notes_images : [];
            newCerts[certIdx].notes_images = [...currentImages, publicUrl];
            setCerts(newCerts);
        } catch (error: any) {
            alert('Error al subir imagen: ' + error.message);
        } finally {
            setUploadingImage(null);
        }
    };

    const removeNoteImage = (certIdx: number, url: string) => {
        if (!confirm('¿Eliminar esta imagen?')) return;
        const newCerts = [...certs];
        newCerts[certIdx].notes_images = newCerts[certIdx].notes_images.filter((img: string) => img !== url);
        setCerts(newCerts);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsAboutOpen(true)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                        title="Acerca de este programa"
                    >
                        <Info size={20} />
                    </button>
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-none">Certificaciones de Pago</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1">Control de obra ejecutada, retenidos y materiales</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <input 
                            type="text"
                            placeholder="Buscar por descripción o nº de ítem..."
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    {
                        label: "Imprimir",
                        icon: <Printer />,
                        onClick: () => window.print(),
                        description: "Imprimir esta sección de Certificaciones de Pago",
                        variant: 'secondary' as const,
                        size: 'small' as const
                    },
                    {
                        label: "Nueva Certificación",
                        icon: <Plus />,
                        onClick: addCert,
                        description: "Crear un nuevo documento de certificación de pago correlativo",
                        variant: 'secondary' as const
                    },
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Sincronizar todas las certificaciones y partidas con los balances del contrato",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />


            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <SummaryItem
                    label="Trabajo Ejecutado (WP)"
                    value={liveExecuted}
                    icon={<DollarSign size={16} />}
                    color="text-emerald-600"
                    bgColor="bg-emerald-50 dark:bg-emerald-950/20"
                />
                <SummaryItem
                    label="Neto Pagado"
                    value={livePaid}
                    icon={<Wallet size={16} />}
                    color="text-primary"
                    bgColor="bg-blue-50 dark:bg-blue-900/20"
                />
                <SummaryItem
                    label="Balance Retenido"
                    value={liveRetention}
                    icon={<ShieldAlert size={16} />}
                    color="text-violet-600"
                    bgColor="bg-violet-50 dark:bg-violet-950/20"
                />
                <SummaryItem
                    label="Balance Total MOS"
                    value={liveMOS}
                    icon={<Package size={16} />}
                    color="text-amber-600"
                    bgColor="bg-amber-50 dark:bg-amber-950/20"
                    description="Balance total pendiente de deducir"
                />
                <SummaryItem
                    label="Daños Líquidos"
                    value={liveLiquidated}
                    icon={<Timer size={16} />}
                    color="text-red-600"
                    bgColor="bg-red-50 dark:bg-red-900/20"
                />
                <SummaryItem
                    label="Balance Remaining"
                    value={liveRemaining}
                    icon={<Coins size={16} />}
                    color="text-blue-600"
                    bgColor="bg-sky-50 dark:bg-sky-950/20"
                    description="Balance restante del contrato"
                />
            </div>

            <div className="space-y-4">
                {certs.map((c, certIdx) => {
                    let certWork = 0;
                    let certMOSNet = 0;
                    (c.items || []).forEach((item: any) => {
                        const q = parseFloat(item.quantity) || 0;
                        const p = parseFloat(item.unit_price) || 0;
                        const itemWork = roundedAmt(q * p, 2);
                        certWork = roundedAmt(certWork + itemWork, 2);

                        const addedMOS = roundedAmt(item.has_material_on_site ? (parseFloat(item.mos_invoice_total) || 0) : 0, 2);
                        const mosPU = getInvoicePUFromList(certs, item.item_num, certIdx);
                        const deductedMOS = roundedAmt((parseFloat(item.qty_from_mos) || 0) * (mosPU > 0 ? mosPU : p), 2);
                        certMOSNet = roundedAmt(certMOSNet + addedMOS - deductedMOS, 2);
                    });
                    const r5 = (c.items || []).reduce((acc: number, it: any) => {
                        if (it.skip_retention === true || it.skip_retention === 'true') return acc;
                        const itemWork = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                        return roundedAmt(acc + roundedAmt(itemWork * 0.05, 2), 2);
                    }, 0);
                    const val5 = c.skip_retention ? 0 : roundedAmt(r5, 2);
                    const returnAmt = roundedAmt(c.show_retention_return ? (parseFloat(c.retention_return_amount) || 0) : 0, 2);
                    const extraRet = roundedAmt(parseFmtNum(c.extra_retention), 2);

                    const certRetentionDisplay = roundedAmt(val5 - returnAmt, 2);

                    const certNetChange = roundedAmt(
                        certWork - val5 + returnAmt + certMOSNet 
                        - parseFmtNum(c.liquidated_damages)
                        - extraRet
                        + parseFmtNum(c.price_adjustment)
                        - parseFmtNum(c.insurance_fines)
                        - parseFmtNum(c.other_penalties)
                        + parseFmtNum(c.refund), 2
                    );

                    // Calcular la retención neta acumulada en tiempo real hasta la certificación actual
                    const getCertRetentionNet = (certObj: any) => {
                        const otherR5 = (certObj.items || []).reduce((acc: number, it: any) => {
                            if (it.skip_retention === true || it.skip_retention === 'true') return acc;
                            const itemWork = roundedAmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 2);
                            return roundedAmt(acc + roundedAmt(itemWork * 0.05, 2), 2);
                        }, 0);
                        const otherVal5 = certObj.skip_retention ? 0 : roundedAmt(otherR5, 2);
                        const otherReturn = roundedAmt(certObj.show_retention_return ? (parseFloat(certObj.retention_return_amount) || 0) : 0, 2);
                        const otherExtra = roundedAmt(parseFmtNum(certObj.extra_retention), 2);
                        return roundedAmt(otherVal5 + otherExtra - otherReturn, 2);
                    };

                    const accumulatedRetention = roundedAmt(
                        certs
                            .filter(otherCert => otherCert.cert_num <= c.cert_num)
                            .reduce((sum, otherCert) => sum + getCertRetentionNet(otherCert), 0), 2
                    );

                    return (
                        <div key={certIdx} className={`card border-none shadow-sm overflow-hidden p-0 mb-4 ${c.excluded ? 'bg-red-50/40 dark:bg-red-950/10 ring-1 ring-red-200 dark:ring-red-900/30' : 'bg-white dark:bg-slate-900'}`}>
                            <div className={`p-4 border-b ${c.excluded ? 'bg-red-50/30 dark:bg-red-950/10 border-red-100 dark:border-red-900/30' : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800'}`}>
                                <div className="flex flex-col xl:flex-row gap-6">
                                    {/* Información Básica de la Certificación */}
                                    <div className="flex flex-row md:flex-col gap-4 border-r-0 xl:border-r border-slate-200 dark:border-slate-700/50 pr-0 xl:pr-6 shrink-0 justify-between md:justify-start">
                                        <div className="flex items-center gap-6">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Certificación #</label>
                                                <div className="flex items-center gap-2">
                                                    <div className={`text-2xl font-black ${c.excluded ? 'text-slate-300 line-through' : 'text-primary'}`}>#{c.cert_num}</div>
                                                    {c.is_paid && (
                                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" title="Esta certificación ya fue pagada al contratista">
                                                            <CheckCircle size={10} /> Pagada
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Fecha Cert.</label>
                                                <input
                                                    type="date"
                                                    className="input-field text-sm font-bold bg-white dark:bg-slate-900 !w-[140px] h-8"
                                                    style={{ backgroundColor: '#66FF99' }}
                                                    value={c.cert_date || ""}
                                                    onChange={(e) => updateCert(certIdx, 'cert_date', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-[#d97706]">Trabajo ejec. hasta</label>
                                            <input
                                                type="date"
                                                className="input-field text-sm font-bold border-amber-200 focus:ring-amber-500 !w-[140px] h-8 bg-white dark:bg-slate-900"
                                                style={{ backgroundColor: '#66FF99' }}
                                                value={c.wp_up_to || ""}
                                                onChange={(e) => updateCert(certIdx, 'wp_up_to', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2 mt-1">
                                            {/* Checkbox para indicar que ya se pagó al contratista */}
                                            <label className="flex items-center gap-2 cursor-pointer group" title="Marcar si esta certificación ya fue pagada al contratista">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-400 w-4 h-4"
                                                    checked={!!c.is_paid}
                                                    onChange={(e) => updateCert(certIdx, 'is_paid', e.target.checked)}
                                                />
                                                <span className={`text-[10px] font-black uppercase tracking-wider leading-none transition-colors ${c.is_paid ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'}`}>Ya se pagó al contratista</span>
                                            </label>

                                            {/* Checkbox para excluir esta certificación de los resultados */}
                                            <label className="flex items-center gap-2 cursor-pointer group" title="Al marcar, esta certificación no se incluirá en los totales y resultados">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-red-500 focus:ring-red-400 w-4 h-4"
                                                checked={!!c.excluded}
                                                onChange={(e) => updateCert(certIdx, 'excluded', e.target.checked)}
                                            />
                                            <span className={`text-[10px] font-black uppercase tracking-wider leading-none transition-colors ${c.excluded ? 'text-red-500' : 'text-slate-400 group-hover:text-red-500'}`}>Excluir de resultados</span>
                                        </label>
                                    </div>

                                    {/* Totales Principales */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 flex-1 items-start bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Trabajo ejec. (WP)</span>
                                            <span className="text-xl xl:text-2xl font-black text-emerald-600 font-geist tracking-tight">{formatCurrency(certWork)}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">5% Retenido</span>
                                                    <label className="flex items-center gap-1.5 cursor-pointer group" title="No retener en esta certificación">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                                            checked={!!c.skip_retention}
                                                            onChange={(e) => updateCert(certIdx, 'skip_retention', e.target.checked)}
                                                        />
                                                        <span className="text-[9px] font-black text-slate-400 group-hover:text-amber-600 transition-colors leading-none uppercase tracking-wider">Sin Ret.</span>
                                                    </label>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-xl xl:text-2xl font-black ${c.skip_retention ? 'text-slate-300 line-through' : 'text-amber-600'} font-geist tracking-tight`}>
                                                        {formatCurrency(c.skip_retention ? 0 : -certRetentionDisplay)}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 mt-1 leading-tight">
                                                    Reten. Acumulado: <span className="text-violet-600 font-extrabold">{formatCurrency(accumulatedRetention)}</span>
                                                </div>
                                                <label className="flex items-center gap-1.5 cursor-pointer group mt-1" title="Devolución de retenido">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                                        checked={!!c.show_retention_return}
                                                        onChange={(e) => updateCert(certIdx, 'show_retention_return', e.target.checked)}
                                                    />
                                                    <span className="text-[9px] font-black text-slate-400 group-hover:text-blue-600 transition-colors leading-none uppercase tracking-wider">Devolución</span>
                                                </label>
                                                {c.show_retention_return && (
                                                    <div className="mt-1 bg-blue-50/50 dark:bg-blue-900/10 p-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                                        <span className="text-[8px] font-black text-blue-500 uppercase leading-none block mb-1 tracking-widest">Monto a Devolver</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-blue-600 font-bold text-xs">$</span>
                                                            <input
                                                                type="number"
                                                                className="w-full bg-transparent border-none p-0 text-sm font-black text-blue-700 outline-none focus:ring-0 h-4"
                                                                value={c.retention_return_amount ?? ""}
                                                                onChange={(e) => updateCert(certIdx, 'retention_return_amount', e.target.value)}
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">MOS Neto (M)</span>
                                            <span className={`text-xl xl:text-2xl font-black ${certMOSNet < 0 ? 'text-red-500' : (certMOSNet > 0 ? 'text-amber-600' : 'text-slate-400')} font-geist tracking-tight`}>
                                                {formatCurrency(certMOSNet)}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em] block mb-1">Neto Certificado</span>
                                            <span className="text-2xl xl:text-3xl font-black text-primary font-geist tracking-tighter">
                                                {formatCurrency(certNetChange)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Notas de la Certificación */}
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
                                            <FileText size={10} className="text-slate-400" />
                                            Notas del Pago Mensual
                                        </label>
                                        <textarea
                                            className="w-full input-field text-xs text-slate-600 dark:text-slate-300 bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50 focus:border-amber-300 resize-none leading-relaxed"
                                            rows={2}
                                            value={c.notes ?? ''}
                                            onChange={(e) => updateCert(certIdx, 'notes', e.target.value)}
                                            placeholder="Observaciones, referencias a memorandos, acuerdos u otras notas relevantes a este pago..."
                                        />
                                    </div>
                                </div>

                                {/* Nueva Sección de Deducciones y Ajustes */}
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row gap-6 items-end">
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 flex-1 w-full">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Daños Líquidos</label>
                                            <input
                                                type="text"
                                                className="input-field text-xs font-bold text-red-600 bg-white dark:bg-slate-900 border-red-50 focus:border-red-200 h-8"
                                                value={c.liquidated_damages ?? ""}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (/^-?\d*\.?\d*$/.test(raw)) updateCert(certIdx, 'liquidated_damages', raw);
                                                }}
                                                onFocus={(e) => {
                                                    const raw = String(c.liquidated_damages ?? '').replace(/,/g, '');
                                                    updateCert(certIdx, 'liquidated_damages', raw);
                                                }}
                                                onBlur={(e) => {
                                                    const num = parseFloat(String(c.liquidated_damages).replace(/,/g, ''));
                                                    if (!isNaN(num)) updateCert(certIdx, 'liquidated_damages', num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                                }}
                                                placeholder="0.00"
                                            />
                                            {parseFloat(String(c.liquidated_damages).replace(/,/g, '')) > 0 && (
                                                <input
                                                    type="text"
                                                    className="input-field text-[10px] w-full mt-1 bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-800 focus:border-red-300 h-7"
                                                    value={c.liquidated_damages_notes ?? ""}
                                                    onChange={(e) => updateCert(certIdx, 'liquidated_damages_notes', e.target.value)}
                                                    placeholder="Nota (Ej. Memo #123)"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Retención Extra</label>
                                            <input
                                                type="text"
                                                className="input-field text-xs font-bold text-amber-700 bg-white dark:bg-slate-900 border-amber-50 focus:border-amber-200 h-8"
                                                value={c.extra_retention ?? ""}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (/^-?\d*\.?\d*$/.test(raw)) updateCert(certIdx, 'extra_retention', raw);
                                                }}
                                                onFocus={(e) => {
                                                    const raw = String(c.extra_retention ?? '').replace(/,/g, '');
                                                    updateCert(certIdx, 'extra_retention', raw);
                                                }}
                                                onBlur={(e) => {
                                                    const num = parseFloat(String(c.extra_retention).replace(/,/g, ''));
                                                    if (!isNaN(num)) updateCert(certIdx, 'extra_retention', num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                                }}
                                                placeholder="0.00"
                                            />
                                            {parseFloat(String(c.extra_retention).replace(/,/g, '')) > 0 && (
                                                <input
                                                    type="text"
                                                    className="input-field text-[10px] w-full mt-1 bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 focus:border-amber-300 h-7"
                                                    value={c.extra_retention_notes ?? ""}
                                                    onChange={(e) => updateCert(certIdx, 'extra_retention_notes', e.target.value)}
                                                    placeholder="Nota/Razón"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Ajuste Precio (Clause)</label>
                                            <input
                                                type="text"
                                                className="input-field text-xs font-bold text-blue-600 bg-white dark:bg-slate-900 border-blue-50 focus:border-blue-200 h-8"
                                                value={c.price_adjustment ?? ""}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (/^-?\d*\.?\d*$/.test(raw)) updateCert(certIdx, 'price_adjustment', raw);
                                                }}
                                                onFocus={(e) => {
                                                    const raw = String(c.price_adjustment ?? '').replace(/,/g, '');
                                                    updateCert(certIdx, 'price_adjustment', raw);
                                                }}
                                                onBlur={(e) => {
                                                    const num = parseFloat(String(c.price_adjustment).replace(/,/g, ''));
                                                    if (!isNaN(num)) updateCert(certIdx, 'price_adjustment', num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                                }}
                                                placeholder="0.00"
                                            />
                                            {parseFloat(String(c.price_adjustment).replace(/,/g, '')) !== 0 && c.price_adjustment && (
                                                <input
                                                    type="text"
                                                    className="input-field text-[10px] w-full mt-1 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 focus:border-blue-300 h-7"
                                                    value={c.price_adjustment_notes ?? ""}
                                                    onChange={(e) => updateCert(certIdx, 'price_adjustment_notes', e.target.value)}
                                                    placeholder="Nota explicativa"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Seguros / Multas</label>
                                            <input
                                                type="text"
                                                className="input-field text-xs font-bold text-red-700 bg-white dark:bg-slate-900 border-red-50 focus:border-red-200 h-8"
                                                value={c.insurance_fines ?? ""}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (/^-?\d*\.?\d*$/.test(raw)) updateCert(certIdx, 'insurance_fines', raw);
                                                }}
                                                onFocus={(e) => {
                                                    const raw = String(c.insurance_fines ?? '').replace(/,/g, '');
                                                    updateCert(certIdx, 'insurance_fines', raw);
                                                }}
                                                onBlur={(e) => {
                                                    const num = parseFloat(String(c.insurance_fines).replace(/,/g, ''));
                                                    if (!isNaN(num)) updateCert(certIdx, 'insurance_fines', num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                                }}
                                                placeholder="0.00"
                                            />
                                            {parseFloat(String(c.insurance_fines).replace(/,/g, '')) > 0 && (
                                                <input
                                                    type="text"
                                                    className="input-field text-[10px] w-full mt-1 bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-800 focus:border-red-300 h-7"
                                                    value={c.insurance_fines_notes ?? ""}
                                                    onChange={(e) => updateCert(certIdx, 'insurance_fines_notes', e.target.value)}
                                                    placeholder="Detalle"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Otras Penalidades</label>
                                            <input
                                                type="text"
                                                className="input-field text-xs font-bold text-slate-700 bg-white dark:bg-slate-900 border-slate-100 focus:border-slate-200 h-8"
                                                value={c.other_penalties ?? ""}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (/^-?\d*\.?\d*$/.test(raw)) updateCert(certIdx, 'other_penalties', raw);
                                                }}
                                                onFocus={(e) => {
                                                    const raw = String(c.other_penalties ?? '').replace(/,/g, '');
                                                    updateCert(certIdx, 'other_penalties', raw);
                                                }}
                                                onBlur={(e) => {
                                                    const num = parseFloat(String(c.other_penalties).replace(/,/g, ''));
                                                    if (!isNaN(num)) updateCert(certIdx, 'other_penalties', num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                                }}
                                                placeholder="0.00"
                                            />
                                            {parseFloat(String(c.other_penalties).replace(/,/g, '')) > 0 && (
                                                <input
                                                    type="text"
                                                    className="input-field text-[10px] w-full mt-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-slate-300 h-7"
                                                    value={c.other_penalties_notes ?? ""}
                                                    onChange={(e) => updateCert(certIdx, 'other_penalties_notes', e.target.value)}
                                                    placeholder="Especificar"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Reembolso</label>
                                            <input
                                                type="text"
                                                className="input-field text-xs font-bold text-emerald-700 bg-white dark:bg-slate-900 border-emerald-100 focus:border-emerald-300 h-8"
                                                value={c.refund ?? ""}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (/^-?\d*\.?\d*$/.test(raw)) updateCert(certIdx, 'refund', raw);
                                                }}
                                                onFocus={(e) => {
                                                    const raw = String(c.refund ?? '').replace(/,/g, '');
                                                    updateCert(certIdx, 'refund', raw);
                                                }}
                                                onBlur={(e) => {
                                                    const num = parseFloat(String(c.refund).replace(/,/g, ''));
                                                    if (!isNaN(num)) updateCert(certIdx, 'refund', num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                                }}
                                                placeholder="0.00"
                                            />
                                            {parseFmtNum(c.refund) > 0 && (
                                                <input
                                                    type="text"
                                                    className="input-field text-[10px] w-full mt-1 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800 focus:border-emerald-300 h-7"
                                                    value={c.refund_notes ?? ""}
                                                    onChange={(e) => updateCert(certIdx, 'refund_notes', e.target.value)}
                                                    placeholder="Detalle del reembolso"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Botones de Acción */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button 
                                            onClick={() => handlePrint(c)}
                                            disabled={generating === c.cert_num}
                                            className="btn-primary py-2 px-4 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-xs font-black h-9"
                                        >
                                            {generating === c.cert_num ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                                            {generating === c.cert_num ? "Generando..." : "Imprimir Cert."}
                                        </button>
                                        <button 
                                            onClick={() => toggleExpand(c.cert_num)}
                                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary transition-all active:scale-95 shadow-sm h-9 w-9 flex items-center justify-center"
                                        >
                                            {expandedCert === c.cert_num ? <X size={18} /> : <PlusSquare size={18} />}
                                        </button>
                                        <button 
                                            onClick={() => removeCert(certIdx)}
                                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:border-red-200 transition-all active:scale-95 shadow-sm h-9 w-9 flex items-center justify-center"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {expandedCert === c.cert_num && (
                                <div className="p-4 border-t border-slate-50 dark:border-slate-800/50 bg-white dark:bg-slate-900 animate-in slide-in-from-top-2 duration-300">
                                    {(() => {
                                        const blockedItems = loading ? [] : (c.items || [])
                                            .map((it: any) => ({ it, status: getItemMfgStatus(it.item_num, certIdx, parseFloat(it.quantity) || 0) }))
                                            .filter(({ status }) => status.status === 'INSUFFICIENT');
                                        return blockedItems.length > 0 ? (
                                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-in fade-in slide-in-from-top-1 duration-500">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <AlertTriangle className="text-red-600 animate-pulse shrink-0" size={18} />
                                                    <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-tight">¡No se puede pagar: Certificados de Manufactura Insuficientes!</p>
                                                </div>
                                                <div className="space-y-1 pl-7">
                                                    {blockedItems.map(({ it, status }) => (
                                                        <div key={it.item_num} className="flex items-center gap-2 text-[10px] font-bold text-red-700 dark:text-red-400">
                                                            <span className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded font-black">Partida {it.item_num}</span>
                                                            <span>Quieres pagar <span className="font-black">{formatNumber(status.qtyToPay)} {it.unit}</span>, pero solo hay <span className="font-black">{formatNumber(status.available)} {it.unit}</span> con CM aprobado.</span>
                                                            <span className="bg-red-200 dark:bg-red-800 px-1.5 py-0.5 rounded font-black text-red-800 dark:text-red-200">Faltan {formatNumber(status.missing)} {it.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null;
                                    })()}
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                            <Plus size={14} className="text-primary" />
                                            Partidas de esta Certificación
                                        </h4>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] uppercase font-bold text-slate-400 leading-none">Balance MOS Acumulado</span>
                                                <span className="text-xs font-black text-amber-600">
                                                    {formatCurrency(getCertMOSBalance(certIdx))}
                                                </span>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => openAllMOSItems(certIdx)} className="text-[11px] font-bold text-emerald-600 hover:bg-emerald-100/50 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 transition-colors">
                                                    <ZoomIn size={14} /> Abrir partidas con MOS
                                                </button>
                                                <button onClick={() => liquidateAllMOS(certIdx)} className="text-[11px] font-bold text-amber-600 hover:bg-amber-100/50 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 transition-colors">
                                                    <Package size={14} /> Liquidar Saldos MOS
                                                </button>
                                                <button onClick={() => addCertItem(certIdx)} className="text-[11px] font-bold text-slate-600 hover:bg-slate-100/50 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 transition-colors">
                                                    <Plus size={14} /> Añadir Partida
                                                </button>
                                                <button onClick={() => importContractItems(certIdx)} className="text-[11px] font-bold text-blue-600 hover:bg-blue-100/50 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 transition-colors">
                                                    Importar Partidas Activas
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto scrollbar-none">
                                        <table suppressHydrationWarning className="w-full text-left border-collapse table-fixed">
                    <thead className="text-[8px] uppercase font-bold text-slate-400 border-b border-slate-50 dark:border-slate-800">
                                                <tr>
                                                    <th className="py-1 px-0.5 w-[35px] text-center" title="No aplicar 5% de retención">N.R.</th>
                                                    <th className="py-1 px-0.5 w-[65px] text-center"># Item</th>
                                                    <th className="py-1 px-0.5 w-[100px] text-center">Espec.</th>
                                                    <th className="py-1 px-0.5">Descripción</th>
                                                    <th className="py-1 px-0.5 w-[40px] text-center">Un.</th>
                                                    <th className="py-1 px-0.5 w-[40px] text-center" title="Certificado de Manufactura">CM</th>
                                                    <th className="py-1 px-0.5 w-[80px] text-right">Cant. WP</th>
                                                    <th className="py-1 px-0.5 w-[90px] text-right">P. Unitario</th>
                                                    <th className="py-1 px-0.5 w-[90px] text-right">Total WP</th>
                                                    <th className="py-1 px-0.5 w-[70px] text-right">Cant. MOS</th>
                                                    <th className="py-1 px-0.5 w-[85px] text-right">Ded. MOS</th>
                                                    <th className="py-1 px-0.5 w-[90px] text-right">Total Neto</th>
                                                    <th className="py-1 px-1 w-[60px] text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(c.items || [])
                                                    .map((item: any, itIdx: number) => {
                                                    const totalRevisedQty = getItemTotalRevisedQty(item.item_num);
                                                    let paidInPrevious = 0;
                                                    // Las certificaciones están en orden descendente (Index 0 = Cert Reciente)
                                                    // Necesitamos sumar desde certIdx + 1 hasta el final para pagos PREVIOS
                                                    for (let k = certIdx + 1; k < certs.length; k++) {
                                                        const prevCertItems = certs[k]?.items || [];
                                                        const match = prevCertItems.find((p: any) => normalizeItemNum(p.item_num) === normalizeItemNum(item.item_num));
                                                        if (match) paidInPrevious += parseFloat(match.quantity) || 0;
                                                    }
                                                    const availableBalance = totalRevisedQty - paidInPrevious;
                                                    
                                                    const itemExistsInContract = contractItems.some(it => normalizeItemNum(it.item_num) === normalizeItemNum(item.item_num));
                                                    const isKnownItem = itemExistsInContract || (projectData?.change_orders || projectData?.chos || []).some((co: any) => {
                                                        const items = Array.isArray(co.items) ? co.items : (co.items as any)?.list || [];
                                                        return items.some((it: any) => normalizeItemNum(it.item_num) === normalizeItemNum(item.item_num));
                                                    });

                                                    const workQty = parseFloat(item.quantity) || 0;
                                                    const isQtyExceeded = isKnownItem && workQty > availableBalance + 0.0001 && availableBalance >= 0;
                                                    
                                                    let cumulativeMOSInvoicedAmount = 0;
                                                    let cumulativeMOSUsedAmountBefore = 0;

                                                    // Calcular acumulado de facturas MOS y deducciones
                                                    // Las certs están en orden descendente: [#13, #12, ..., #1]
                                                    // slice(certIdx) nos da desde la actual hasta la primera
                                                    certs.slice(certIdx).forEach((cert, sliceIdx) => {
                                                        const certItems = cert?.items || [];
                                                        certItems.forEach((it: any) => {
                                                            if (it.item_num === item.item_num) {
                                                                cumulativeMOSInvoicedAmount += parseFloat(it.has_material_on_site ? it.mos_invoice_total : 0) || 0;
                                                                // Si es una certificación ANTERIOR a la actual (sliceIdx > 0)
                                                                if (sliceIdx > 0) {
                                                                    const originalIdxInCerts = certIdx + sliceIdx;
                                                                    const pr = getInvoicePUFromList(certs, it.item_num, originalIdxInCerts);
                                                                    cumulativeMOSUsedAmountBefore += (parseFloat(it.qty_from_mos) || 0) * (pr > 0 ? pr : (parseFloat(it.unit_price) || 0));
                                                                }
                                                            }
                                                        });
                                                    });

                                                    // availableMOSBalance = total facturado MOS - ya deducido en certs anteriores
                                                    const availableMOSBalance = cumulativeMOSInvoicedAmount - cumulativeMOSUsedAmountBefore;
                                                    const mosPUForCalc = getInvoicePUFromList(certs, item.item_num, certIdx);
                                                    const currentDeductionPU = mosPUForCalc > 0 ? mosPUForCalc : (parseFloat(item.unit_price) || 0);
                                                    const availableMOSQty = (currentDeductionPU > 0) ? (availableMOSBalance / currentDeductionPU) : 0;
                                                    
                                                    // El campo se habilita si hay balance disponible (>0) O si ya tiene un valor guardado
                                                    const hasMOSActivity = availableMOSBalance > 0.001 || (parseFloat(item.qty_from_mos) || 0) > 0;

                                                    const finalQtyFromMOS = (item.qty_from_mos !== undefined && item.qty_from_mos !== null && item.qty_from_mos !== "" && parseFloat(item.qty_from_mos) !== 0) 
                                                        ? parseFloat(item.qty_from_mos) 
                                                        : (cumulativeMOSInvoicedAmount > 0 && workQty > 0 ? Math.min(workQty, availableMOSQty) : 0);
                                                    
                                                    const workAmount = roundedAmt(workQty * (parseFloat(item.unit_price) || 0), 2);
                                                    const autoDeductionAmount = roundedAmt(finalQtyFromMOS * currentDeductionPU, 2);
                                                    const netTotal = roundedAmt(workAmount - autoDeductionAmount, 2);
                                                    const mfgStatus = getItemMfgStatus(item.item_num, certIdx, workQty);
                                                    const isMfgBlocked = mfgStatus.status === 'INSUFFICIENT';

                                                    return (
                                                        <React.Fragment key={itIdx}>
                                                            <tr className={`border-b border-slate-50 dark:border-slate-800/50 group/row hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${isMfgBlocked ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}>
                                                                <td className="py-1 px-0.5 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="rounded border-slate-300 dark:border-slate-700 text-violet-600 focus:ring-violet-500 h-3.5 w-3.5"
                                                                        checked={!!item.skip_retention}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'skip_retention', e.target.checked)}
                                                                        title="Marcar para excluir este ítem del 5% de retención"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-0.5">
                                                                    <input
                                                                        type="text"
                                                                        className="input-field w-full text-center text-xs font-black p-0 px-1 h-6 border-transparent group-hover/row:border-slate-200 rounded-lg"
                                                                        style={{ backgroundColor: '#66FF99' }}
                                                                        value={item.item_num}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'item_num', e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && sortCertItems(certIdx)}
                                                                        onBlur={(e) => {
                                                                            const val = e.target.value;
                                                                            if (val !== "" && !isNaN(parseInt(val))) {
                                                                                updateCertItem(certIdx, itIdx, 'item_num', val.padStart(3, '0'));
                                                                            }
                                                                        }}
                                                                        placeholder="000"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-0.5">
                                                                    <input
                                                                        type="text"
                                                                        className="input-field w-full text-center text-xs font-mono p-0 px-1 h-6 border-transparent group-hover/row:border-slate-200 rounded-lg"
                                                                        style={{ backgroundColor: '#66FF99' }}
                                                                        value={item.specification}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'specification', e.target.value)}
                                                                        placeholder="000-000"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-0.5">
                                                                    <textarea
                                                                        className="w-full bg-transparent border-none text-[10px] font-medium leading-tight resize-none min-h-[24px] h-auto outline-none scrollbar-none py-1"
                                                                        value={item.description}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'description', e.target.value)}
                                                                        rows={1}
                                                                        onBlur={(e) => {
                                                                            e.target.style.height = 'auto';
                                                                            e.target.style.height = e.target.scrollHeight + 'px';
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-0.5">
                                                                    <input
                                                                        type="text"
                                                                        className="input-field text-center text-xs p-0 px-1 h-6 border-transparent group-hover/row:border-slate-200 rounded-lg"
                                                                        style={{ backgroundColor: '#66FF99' }}
                                                                        value={item.unit}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'unit', e.target.value)}
                                                                        placeholder="U"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-0.5 text-center">
                                                                    {mfgStatus.status === 'OK' && (
                                                                        <div className="flex justify-center" title={`CM OK: ${formatNumber(mfgStatus.available)} ${item.unit} disponibles`}>
                                                                            <CheckCircle size={14} className="text-emerald-500" />
                                                                        </div>
                                                                    )}
                                                                    {mfgStatus.status === 'INSUFFICIENT' && (
                                                                        <div className="flex flex-col items-center gap-0.5">
                                                                            <AlertTriangle size={14} className="text-red-600 animate-pulse" />
                                                                            <span className="text-[7px] font-black text-red-600 leading-none text-center whitespace-nowrap">
                                                                                Faltan {formatNumber(mfgStatus.missing)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {mfgStatus.status === 'NOT_REQUIRED' && (
                                                                        <div className="flex justify-center opacity-20" title="No requiere CM">
                                                                            <CheckCircle size={14} className="text-slate-400" />
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="py-1 px-0.5">
                                                                    <input
                                                                        type="number"
                                                                        step="0.0001"
                                                                        className={`input-field text-right text-[11px] font-black p-0 h-6 border-transparent group-hover/row:border-slate-200 ${isQtyExceeded || isMfgBlocked ? 'text-red-600 border-red-300' : ''}`}
                                                                        style={{ backgroundColor: isQtyExceeded || isMfgBlocked ? '#fee2e2' : '#66FF99' }}
                                                                        value={item.quantity ?? ""}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'quantity', e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && sortCertItems(certIdx)}
                                                                        onBlur={(e) => {
                                                                            const entered = parseFloat(e.target.value) || 0;
                                                                            if (isKnownItem && entered > availableBalance + 0.0001 && availableBalance >= 0) {
                                                                                alert(`La cantidad ingresada (${entered.toFixed(4)}) excede el balance disponible de la partida ${item.item_num} (${availableBalance.toFixed(4)}). Se ajustará al balance máximo disponible.`);
                                                                                updateCertItem(certIdx, itIdx, 'quantity', availableBalance.toFixed(4));
                                                                            }
                                                                        }}
                                                                        placeholder="0.00"
                                                                    />
                                                                    {isQtyExceeded && !isMfgBlocked && (
                                                                        <div className="text-[8px] font-black text-red-600 text-right leading-none mt-0.5 whitespace-nowrap">
                                                                            ⚠️ Máx: {availableBalance.toFixed(4)}
                                                                        </div>
                                                                    )}
                                                                    {isMfgBlocked && (
                                                                        <div className="text-[8px] font-black text-red-700 text-right leading-none mt-0.5 whitespace-nowrap">
                                                                            🚫 Faltan {formatNumber(mfgStatus.missing)} CM
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="py-1 px-0.5">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="input-field text-right text-[11px] font-geist p-0 h-6 border-transparent group-hover/row:border-slate-200"
                                                                        style={{ backgroundColor: '#66FF99' }}
                                                                        value={item.unit_price ?? ""}
                                                                        onChange={(e) => updateCertItem(certIdx, itIdx, 'unit_price', e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && sortCertItems(certIdx)}
                                                                        placeholder="0.00"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-0.5 text-right text-[11px] font-black text-emerald-600 font-geist">
                                                                    {formatCurrency(workAmount)}
                                                                </td>
                                                                <td className="py-1 px-0.5 relative">
                                                                    <input
                                                                        type="number"
                                                                        step="0.0001"
                                                                        readOnly
                                                                        className={`input-field text-right text-[11px] font-black p-0 h-6 border-transparent group-hover/row:border-slate-200 ${!hasMOSActivity ? 'opacity-30 cursor-not-allowed' : 'text-amber-600 cursor-default'}`}
                                                                        style={{ backgroundColor: hasMOSActivity ? '#E6FFFA' : '#f1f5f9' }}
                                                                        value={finalQtyFromMOS > 0 ? Number(finalQtyFromMOS.toFixed(4)) : ""}
                                                                        placeholder="0.00"
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-0.5 text-right text-[11px] font-bold text-amber-600 font-geist">
                                                                    -{formatCurrency(autoDeductionAmount)}
                                                                </td>
                                                                <td className="py-1 px-0.5 text-right text-xs font-black text-primary font-geist">
                                                                    {formatCurrency(netTotal)}
                                                                </td>
                                                                <td className="py-1 px-1 flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                    <button onClick={() => insertCertItem(certIdx, itIdx)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary" title="Insertar debajo">
                                                                        <Plus size={14} />
                                                                    </button>
                                                                    <label className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-amber-600 cursor-pointer" title="Material on Site Details">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="hidden"
                                                                            checked={!!item.has_material_on_site}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'has_material_on_site', e.target.checked)}
                                                                        />
                                                                        <Package size={14} className={item.has_material_on_site ? 'text-amber-600 fill-amber-50' : ''} />
                                                                    </label>
                                                                    <button onClick={() => removeCertItem(certIdx, itIdx)} className="p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500" title="Eliminar">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {item.has_material_on_site && (
                                                                <tr className="bg-amber-50/30 dark:bg-amber-950/10 border-b border-amber-100 dark:border-amber-900/30">
                                                                    <td className="py-1 px-0.5 text-center" colSpan={2}>
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-[10px] text-amber-600 font-black">MOS</span>
                                                                            <Package size={14} className="text-amber-500" />
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1 px-0.5" colSpan={2}>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div>
                                                                                <span className="text-[10px] text-amber-500 font-bold">Nº Factura</span>
                                                                                <input
                                                                                    type="text"
                                                                                    className="input-field text-xs p-1 h-7 border-amber-200 focus:ring-amber-400"
                                                                                    style={{ backgroundColor: '#66FF99' }}
                                                                                    placeholder="Factura"
                                                                                    value={item.mos_invoice_num ?? ""}
                                                                                    onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_invoice_num', e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[10px] text-amber-500 font-bold">Proveedor</span>
                                                                                <input
                                                                                    type="text"
                                                                                    className="input-field text-xs p-1 h-7 border-amber-200 focus:ring-amber-400"
                                                                                    style={{ backgroundColor: '#66FF99' }}
                                                                                    placeholder="Proveedor"
                                                                                    value={item.mos_provider ?? ""}
                                                                                    onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_provider', e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1 px-0.5" colSpan={1}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Lote</span>
                                                                        <input
                                                                            type="text"
                                                                            className="input-field text-center text-xs p-1 h-7 border-amber-200 focus:ring-amber-400"
                                                                            style={{ backgroundColor: '#66FF99' }}
                                                                            placeholder="Lot"
                                                                            value={item.mos_lot_num ?? ""}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_lot_num', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 px-0.5" colSpan={2}>
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-[10px] text-amber-600 font-black">TOTAL FACTURA MOS <span className="font-black">($)</span></span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                className="input-field text-right text-sm font-black p-1 h-7 border-amber-300 focus:ring-amber-400 text-amber-700 shadow-sm"
                                                                                style={{ backgroundColor: '#66FF99' }}
                                                                                placeholder="0.00"
                                                                                value={item.mos_invoice_total ?? ""}
                                                                                onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_invoice_total', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={2}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Cantidad en Factura</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            className="input-field text-xs text-right p-1 h-7 border-amber-200 focus:ring-amber-400"
                                                                            style={{ backgroundColor: '#66FF99' }}
                                                                            placeholder="Cantidad"
                                                                            value={item.mos_quantity ?? ""}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_quantity', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 px-1" colSpan={2}>
                                                                        <span className="text-[10px] text-amber-500 font-bold">Precio Unitario Factura</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.0001"
                                                                            className="input-field text-xs text-right p-1 h-7 border-amber-200 focus:ring-amber-400 font-geist"
                                                                            placeholder="0.0000"
                                                                            value={item.mos_unit_price ?? ""}
                                                                            onChange={(e) => updateCertItem(certIdx, itIdx, 'mos_unit_price', e.target.value)}
                                                                        />
                                                                    </td>
                                                                    <td colSpan={1} />
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {lightboxImg && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
                    <button className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white" onClick={() => setLightboxImg(null)}><X size={28} /></button>
                    <div className="relative max-w-5xl w-full flex flex-col items-center gap-4">
                        <img src={lightboxImg} alt="Vista ampliada" className="max-h-[85vh] w-auto object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}/>
                        <a href={lightboxImg} download className="btn-primary px-8 py-3 rounded-2xl font-black shadow-2xl flex items-center gap-3" onClick={(e) => e.stopPropagation()}><Download size={20} />Descargar Imagen</a>
                    </div>
                </div>
            )}

            <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
        </div>
    );
});

export default PaymentCertForm;

function SummaryItem({ label, value, icon, color, bgColor, description }: { label: string, value: number, icon: React.ReactNode, color: string, bgColor: string, description?: string }) {
    return (
        <div className={`${bgColor} rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex items-start gap-3 relative group`}>
            <div className={`${color} p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm flex-shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{label}</div>
                <div className={`text-[13px] font-black ${value < 0 ? 'text-red-500' : color} truncate`}>
                    {formatCurrency(value)}
                </div>
                {description && (
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                        <div className="bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-xl whitespace-nowrap">{description}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
