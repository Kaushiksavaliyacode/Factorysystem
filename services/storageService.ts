import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  getDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { AppData, DispatchEntry, Challan, Party, SlittingJob, ChemicalLog, ChemicalStock, ChemicalPurchase, ProductionPlan, PlantProductionPlan, DispatchStatus, PaymentMode } from '../types';

const PERMANENT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjB3X1iYIeLhYhS8B3X1iYI/exec";
let GOOGLE_SHEET_URL = localStorage.getItem('rdms_sheet_url') || PERMANENT_SCRIPT_URL;

export const setGoogleSheetUrl = (url: string) => {
    GOOGLE_SHEET_URL = url.trim();
    localStorage.setItem('rdms_sheet_url', GOOGLE_SHEET_URL);
};

export const getGoogleSheetUrl = () => GOOGLE_SHEET_URL;

const sanitize = (obj: any): any => {
  const cache = new WeakSet();
  const process = (val: any): any => {
    if (val === null || typeof val !== 'object') return val;
    if (cache.has(val)) return '[Circular]';
    cache.add(val);
    if (val.nodeType || val.window === val) return undefined;
    if (Array.isArray(val)) return val.map(item => process(item)).filter(i => i !== undefined);
    if (val instanceof Date) return val.toISOString();
    const proto = Object.getPrototypeOf(val);
    const isPlainObject = proto === null || proto === Object.prototype;
    if (!isPlainObject) {
      if (typeof val.toJSON === 'function') {
        try { return process(val.toJSON()); } catch (e) { return `[Error Serializing]`; }
      }
      return `[Instance]`;
    }
    const clean: any = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        const item = val[key];
        if (key.startsWith('_') || ['nativeEvent', 'view', 'target', 'currentTarget'].includes(key) || typeof item === 'function') continue;
        const safeVal = process(item);
        if (safeVal !== undefined) clean[key] = safeVal;
      }
    }
    return clean;
  };
  return process(obj);
};

export const subscribeToData = (onDataChange: (data: AppData) => void) => {
  const localData: AppData = { 
      parties: [], dispatches: [], challans: [], slittingJobs: [], 
      productionPlans: [], plantProductionPlans: [],
      chemicalLogs: [], chemicalStock: { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 },
      chemicalPurchases: [] 
  };
  
  let loaded = { p:false, d:false, c:false, s:false, pl:false, ppl:false, cl:false, stock:false, purch:false };

  const checkLoad = () => {
    if (Object.values(loaded).every(v => v)) onDataChange({ ...localData });
  };

  onSnapshot(collection(db, "parties"), s => { localData.parties = s.docs.map(d => d.data() as Party); loaded.p = true; checkLoad(); });
  onSnapshot(collection(db, "dispatches"), s => { localData.dispatches = s.docs.map(d => d.data() as DispatchEntry).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.d = true; checkLoad(); });
  onSnapshot(collection(db, "challans"), s => { localData.challans = s.docs.map(d => d.data() as Challan).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.c = true; checkLoad(); });
  onSnapshot(collection(db, "slitting_jobs"), s => { localData.slittingJobs = s.docs.map(d => d.data() as SlittingJob).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.s = true; checkLoad(); });
  onSnapshot(collection(db, "production_plans"), s => { localData.productionPlans = s.docs.map(d => d.data() as ProductionPlan).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.pl = true; checkLoad(); });
  onSnapshot(collection(db, "plant_production_plans"), s => { localData.plantProductionPlans = s.docs.map(d => d.data() as PlantProductionPlan).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); loaded.ppl = true; checkLoad(); });
  onSnapshot(collection(db, "chemical_logs"), s => { localData.chemicalLogs = s.docs.map(d => d.data() as ChemicalLog).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); loaded.cl = true; checkLoad(); });
  onSnapshot(collection(db, "chemical_purchases"), s => { localData.chemicalPurchases = s.docs.map(d => d.data() as ChemicalPurchase).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); loaded.purch = true; checkLoad(); });
  onSnapshot(doc(db, "chemical_stock", "main"), d => { if (d.exists()) localData.chemicalStock = d.data() as ChemicalStock; loaded.stock = true; checkLoad(); });

  return () => {};
};

const syncToSheet = async (payload: any) => {
    if (!GOOGLE_SHEET_URL) return;
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitize(payload))
        });
    } catch (e) { console.error("Sync Error:", e); }
};

export const saveParty = async (p: Party) => await setDoc(doc(db, "parties", p.id), sanitize(p));
export const updateParty = async (p: Party) => await updateDoc(doc(db, "parties", p.id), sanitize(p));
export const deleteParty = async (id: string) => await deleteDoc(doc(db, "parties", id));

export const saveDispatch = async (d: DispatchEntry) => {
  await setDoc(doc(db, "dispatches", d.id), sanitize(d));
  syncToSheet({ type: 'JOB', ...d });
};
export const deleteDispatch = async (id: string) => {
  await deleteDoc(doc(db, "dispatches", id));
  syncToSheet({ type: 'DELETE_JOB', id });
};

export const saveChallan = async (c: Challan) => {
  await setDoc(doc(db, "challans", c.id), sanitize(c));
  syncToSheet({ type: 'BILL', ...c });
};
export const deleteChallan = async (id: string) => {
  await deleteDoc(doc(db, "challans", id));
  syncToSheet({ type: 'DELETE_BILL', id });
};

export const saveSlittingJob = async (j: SlittingJob) => {
  await setDoc(doc(db, "slitting_jobs", j.id), sanitize(j));
  syncToSheet({ type: 'SLITTING_JOB', ...j });
};
export const deleteSlittingJob = async (id: string) => await deleteDoc(doc(db, "slitting_jobs", id));

export const saveProductionPlan = async (p: ProductionPlan) => {
  await setDoc(doc(db, "production_plans", p.id), sanitize(p));
  syncToSheet({ type: 'PLAN', ...p });
};
export const updateProductionPlan = async (p: Partial<ProductionPlan> & { id: string }) => await updateDoc(doc(db, "production_plans", p.id), sanitize(p));
export const deleteProductionPlan = async (id: string) => await deleteDoc(doc(db, "production_plans", id));

export const savePlantPlan = async (p: PlantProductionPlan) => await setDoc(doc(db, "plant_production_plans", p.id), sanitize(p));
export const updatePlantPlan = async (p: Partial<PlantProductionPlan> & { id: string }) => await updateDoc(doc(db, "plant_production_plans", p.id), sanitize(p));
export const deletePlantPlan = async (id: string) => await deleteDoc(doc(db, "plant_production_plans", id));

export const saveChemicalLog = async (l: ChemicalLog) => await setDoc(doc(db, "chemical_logs", l.id), sanitize(l));
export const saveChemicalPurchase = async (p: ChemicalPurchase) => await setDoc(doc(db, "chemical_purchases", p.id), sanitize(p));
export const deleteChemicalPurchase = async (id: string) => await deleteDoc(doc(db, "chemical_purchases", id));
export const updateChemicalStock = async (s: ChemicalStock) => await setDoc(doc(db, "chemical_stock", "main"), sanitize(s));

export const ensurePartyExists = async (parties: Party[], name: string): Promise<string> => {
  const ex = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (ex) return ex.id;
  const id = `p-${Date.now()}`;
  await saveParty({ id, name, contact: '', address: '' });
  return id;
};

export const syncAllDataToCloud = async (data: AppData, onProgress: (c: number, t: number) => void) => {
    const items: any[] = [];
    data.dispatches.forEach(d => items.push({ type: 'JOB', ...d }));
    data.challans.forEach(c => items.push({ type: 'BILL', ...c }));
    data.slittingJobs.forEach(s => items.push({ type: 'SLITTING_JOB', ...s }));
    const total = items.length;
    for (let i = 0; i < total; i++) {
        onProgress(i + 1, total);
        await syncToSheet(items[i]);
        await new Promise(r => setTimeout(r, 100));
    }
};

export const triggerDashboardSetup = async () => await syncToSheet({ type: 'SETUP_DASHBOARD' });

export const restoreFullBackup = async (backupData: AppData, onProgress: (s: string, c: number, t: number) => void) => {
    const collections = [
        { k: 'parties', n: 'parties' }, { k: 'dispatches', n: 'dispatches' }, { k: 'challans', n: 'challans' },
        { k: 'slittingJobs', n: 'slitting_jobs' }, { k: 'productionPlans', n: 'production_plans' },
        { k: 'plantProductionPlans', n: 'plant_production_plans' }, { k: 'chemicalLogs', n: 'chemical_logs' },
        { k: 'chemicalPurchases', n: 'chemical_purchases' }
    ];
    for (const coll of collections) {
        const items = (backupData as any)[coll.k] || [];
        const total = items.length;
        for (let i = 0; i < total; i += 500) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + 500);
            chunk.forEach((item: any) => batch.set(doc(db, coll.n, item.id), sanitize(item)));
            await batch.commit();
            onProgress(coll.k, Math.min(i + 500, total), total);
        }
    }
    if (backupData.chemicalStock) await updateChemicalStock(backupData.chemicalStock);
};

export const loadDemoData = async () => {
    const batch = writeBatch(db);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    // 1. GENERATE 20 RANDOM INDUSTRIAL PARTIES
    const partyNames = [
        "EXCEL PACKAGING PVT LTD", "MODERN LABELS & PRINTS", "SKYLINE FLEXIBLES", 
        "OCEANIC POLYMERS", "GLOBAL PRINTS", "PRECISION PACK SOLUTIONS", 
        "VIBRANT COLORS CORP", "UNIFIED PACKAGING", "LEGACY LABELS", "PRIME FLEX",
        "MATRIX CONVERTORS", "APEX POLY PACK", "ZENITH FLEXIBLES", "CRYSTAL LABELS",
        "HORIZON FOODS", "GALAXY DAIRIES", "TITAN BEVERAGES", "PIONEER SOLUTIONS",
        "NOVA PACK INDUSTRIES", "OMEGA PRINTS"
    ];
    const parties = partyNames.map((name, i) => ({
        id: `demo-p-${i + 1}`,
        name: name,
        code: `REL/0${10 + i}`,
        contact: "+91 98765 43210",
        address: "Industrial Area Phase " + (i % 3 + 1) + ", Unit " + (i + 1)
    }));
    parties.forEach(p => batch.set(doc(db, "parties", p.id), p));

    // 2. GENERATE 20 RANDOM DISPATCHES (JOBS)
    const jobStatuses = [DispatchStatus.PENDING, DispatchStatus.SLITTING, DispatchStatus.PRINTING, DispatchStatus.COMPLETED, DispatchStatus.DISPATCHED];
    for (let i = 1; i <= 20; i++) {
        const jobDate = i <= 8 ? today : (i <= 15 ? yesterday : lastWeek);
        const pIdx = i % parties.length;
        const status = jobStatuses[i % jobStatuses.length];
        const weight = 45.5 + (i * 12.3);
        const dispatch: DispatchEntry = {
            id: `demo-d-${i}`,
            dispatchNo: (2000 + i).toString(),
            date: jobDate,
            partyId: parties[pIdx].id,
            status: status,
            totalWeight: weight,
            totalPcs: 1200 * i,
            isTodayDispatch: i < 5,
            createdAt: new Date(jobDate).toISOString(),
            updatedAt: new Date(jobDate).toISOString(),
            rows: [{ 
                id: `demo-r-${i}`, 
                size: (150 + (i % 5) * 20) + 'mm', 
                sizeType: i % 2 === 0 ? 'ROLL' : 'ST.SEAL', 
                micron: 35 + (i % 3) * 5, 
                weight: weight, 
                pcs: 1200 * i, 
                bundle: 5 + (i % 10), 
                status: status, 
                isCompleted: status === DispatchStatus.COMPLETED || status === DispatchStatus.DISPATCHED, 
                isLoaded: false,
                productionWeight: status === DispatchStatus.COMPLETED ? weight + 0.5 : 0,
                wastage: status === DispatchStatus.COMPLETED ? 0.5 : 0
            }]
        };
        batch.set(doc(db, "dispatches", dispatch.id), dispatch);
    }

    // 3. GENERATE 20 RANDOM CHALLANS (BILLS)
    for (let i = 1; i <= 20; i++) {
        const billDate = i <= 10 ? today : yesterday;
        const pIdx = (i + 5) % parties.length;
        const mode = i % 3 === 0 ? PaymentMode.CASH : PaymentMode.UNPAID;
        const challan: Challan = {
            id: `demo-c-${i}`,
            challanNumber: (500 + i).toString(),
            partyId: parties[pIdx].id,
            date: billDate,
            totalWeight: 12.5 + i,
            totalAmount: 15400 + (i * 1500),
            paymentMode: mode,
            createdAt: new Date(billDate).toISOString(),
            lines: [{ 
                id: `demo-cl-${i}`, 
                size: (120 + (i % 4) * 10) + ' x 450', 
                weight: 12.5 + i, 
                rate: 125 + (i % 10), 
                amount: 15400 + (i * 1500) 
            }]
        };
        batch.set(doc(db, "challans", challan.id), challan);
    }

    // 4. GENERATE 20 SLITTING JOBS
    for (let i = 1; i <= 20; i++) {
        const slitDate = i <= 10 ? today : yesterday;
        const job: SlittingJob = {
            id: `demo-slit-${i}`,
            date: slitDate,
            jobNo: (3000 + i).toString(),
            jobCode: parties[i % parties.length].code || parties[i % parties.length].name,
            planMicron: 40,
            planQty: 250,
            planRollLength: 2000,
            coils: [
                { id: `c-${i}-1`, number: 1, size: '250mm', rolls: 10, producedBundles: 0 },
                { id: `c-${i}-2`, number: 2, size: '350mm', rolls: 8, producedBundles: 0 }
            ],
            rows: [],
            status: i % 4 === 0 ? 'COMPLETED' : (i % 3 === 0 ? 'IN_PROGRESS' : 'PENDING'),
            createdAt: new Date(slitDate).toISOString(),
            updatedAt: new Date(slitDate).toISOString()
        };
        batch.set(doc(db, "slitting_jobs", job.id), job);
    }

    // 5. PRODUCTION PLANS
    for (let i = 1; i <= 10; i++) {
        const plan: ProductionPlan = {
            id: `demo-plan-${i}`,
            date: today,
            partyName: parties[i % parties.length].name,
            size: (200 + (i % 5) * 50).toString(),
            type: i % 2 === 0 ? "Printing" : "Roll",
            weight: 100 + (i * 20),
            micron: 40,
            meter: 5000 + (i * 100),
            cuttingSize: 450,
            pcs: 12000,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };
        batch.set(doc(db, "production_plans", plan.id), plan);
    }

    // 6. CHEMICAL DATA
    batch.set(doc(db, "chemical_stock", "main"), { dop: 1250, stabilizer: 240, epoxy: 450, g161: 180, nbs: 220 });

    await batch.commit();
    alert("80+ Realistic Demo Records Successfully Loaded! The system is now fully populated for presentation.");
};
