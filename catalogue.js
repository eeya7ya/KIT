'use strict';

/**
 * catalogue.js — Embedded manufacturer component catalogue.
 *
 * Data sourced from real manufacturer specifications and IEC standards:
 *   - Circuit Breakers:  IEC 62271-100 (HV), IEC 60947-2 (LV)
 *   - Disconnectors:    IEC 62271-102
 *   - Fuses:            IEC 60282-1 (HV), IEC 60269 (LV)
 *   - Protection Relays: IEC 60255 series
 *   - Current Transformers: IEC 61869-2
 *   - Voltage Transformers: IEC 61869-3 / -5
 *
 * Voltage classes:
 *   LVCB  : ≤1 kV
 *   MVCB  : >1 kV … ≤36 kV
 *   HVCB  : >36 kV
 */

const CATALOGUE = {

  /* ═══════════════════════════════════════════════════════
     CIRCUIT BREAKERS
     Columns: mfr, model, tech, kv, a, icu, ics, icm, stkw, t_open_ms, t_close_ms, mech
     ═══════════════════════════════════════════════════════ */
  circuit_breakers: [

    /* ── LV Air Circuit Breakers (ACB) ≤1 kV ───────────── */
    { id:'cb001', mfr:'ABB',                model:'Emax2 E1.2 N',       tech:'ACB',  kv:0.69, a:1250, icu:65,  ics:65,  icm:143, stkw:65,  t_open:30, t_close:70,  mech:'Motorized' },
    { id:'cb002', mfr:'ABB',                model:'Emax2 E2.2 N',       tech:'ACB',  kv:0.69, a:2500, icu:65,  ics:65,  icm:143, stkw:65,  t_open:30, t_close:70,  mech:'Motorized' },
    { id:'cb003', mfr:'ABB',                model:'Emax2 E4.2 H',       tech:'ACB',  kv:0.69, a:4000, icu:100, ics:100, icm:220, stkw:100, t_open:28, t_close:65,  mech:'Motorized' },
    { id:'cb004', mfr:'Siemens',            model:'WL 800-H',           tech:'ACB',  kv:0.69, a:800,  icu:65,  ics:65,  icm:143, stkw:65,  t_open:28, t_close:65,  mech:'Motorized' },
    { id:'cb005', mfr:'Siemens',            model:'WL 2500-H',          tech:'ACB',  kv:0.69, a:2500, icu:65,  ics:65,  icm:143, stkw:65,  t_open:28, t_close:65,  mech:'Motorized' },
    { id:'cb006', mfr:'Siemens',            model:'WL 5000-H',          tech:'ACB',  kv:0.69, a:5000, icu:100, ics:100, icm:220, stkw:100, t_open:25, t_close:60,  mech:'Motorized' },
    { id:'cb007', mfr:'Schneider Electric', model:'MasterPact MTZ1 N1', tech:'ACB',  kv:0.69, a:1000, icu:42,  ics:42,  icm:88,  stkw:42,  t_open:30, t_close:68,  mech:'Motorized' },
    { id:'cb008', mfr:'Schneider Electric', model:'MasterPact MTZ2 N1', tech:'ACB',  kv:0.69, a:2500, icu:65,  ics:65,  icm:143, stkw:65,  t_open:30, t_close:68,  mech:'Motorized' },
    { id:'cb009', mfr:'Schneider Electric', model:'MasterPact MTZ3 H2', tech:'ACB',  kv:0.69, a:4000, icu:100, ics:100, icm:220, stkw:100, t_open:28, t_close:65,  mech:'Motorized' },
    { id:'cb010', mfr:'Eaton',              model:'Magnum DS 1600-H',   tech:'ACB',  kv:0.69, a:1600, icu:65,  ics:65,  icm:143, stkw:65,  t_open:32, t_close:70,  mech:'Motorized' },
    { id:'cb011', mfr:'Eaton',              model:'Magnum DS 3200-H',   tech:'ACB',  kv:0.69, a:3200, icu:85,  ics:85,  icm:176, stkw:85,  t_open:30, t_close:68,  mech:'Motorized' },
    { id:'cb012', mfr:'GE Vernova',         model:'EntelliGuard G 1600',tech:'ACB',  kv:0.69, a:1600, icu:65,  ics:65,  icm:143, stkw:65,  t_open:30, t_close:68,  mech:'Motorized' },
    { id:'cb013', mfr:'GE Vernova',         model:'EntelliGuard G 4000',tech:'ACB',  kv:0.69, a:4000, icu:100, ics:100, icm:220, stkw:100, t_open:28, t_close:65,  mech:'Motorized' },

    /* ── LV Moulded Case CBs (MCCB) ≤1 kV ──────────────── */
    { id:'cb020', mfr:'ABB',                model:'SACE Tmax XT1 B',    tech:'MCCB', kv:0.69, a:160,  icu:16,  ics:16,  icm:34,  stkw:16,  t_open:null,t_close:null,mech:'Manual' },
    { id:'cb021', mfr:'ABB',                model:'SACE Tmax XT4 N',    tech:'MCCB', kv:0.69, a:250,  icu:36,  ics:36,  icm:75,  stkw:36,  t_open:null,t_close:null,mech:'Manual/Motor' },
    { id:'cb022', mfr:'ABB',                model:'SACE Tmax XT7 N',    tech:'MCCB', kv:0.69, a:1250, icu:50,  ics:50,  icm:105, stkw:50,  t_open:null,t_close:null,mech:'Motor/Manual' },
    { id:'cb023', mfr:'Siemens',            model:'3VA1 125-N',          tech:'MCCB', kv:0.69, a:125,  icu:25,  ics:25,  icm:53,  stkw:25,  t_open:null,t_close:null,mech:'Manual' },
    { id:'cb024', mfr:'Siemens',            model:'3VA2 400-H',          tech:'MCCB', kv:0.69, a:400,  icu:70,  ics:70,  icm:147, stkw:70,  t_open:null,t_close:null,mech:'Motor/Manual' },
    { id:'cb025', mfr:'Siemens',            model:'3VA2 1250-H',         tech:'MCCB', kv:0.69, a:1250, icu:70,  ics:70,  icm:147, stkw:70,  t_open:null,t_close:null,mech:'Motor/Manual' },
    { id:'cb026', mfr:'Schneider Electric', model:'NSX160N',             tech:'MCCB', kv:0.69, a:160,  icu:50,  ics:50,  icm:105, stkw:50,  t_open:null,t_close:null,mech:'Manual' },
    { id:'cb027', mfr:'Schneider Electric', model:'NSX400N',             tech:'MCCB', kv:0.69, a:400,  icu:50,  ics:50,  icm:105, stkw:50,  t_open:null,t_close:null,mech:'Motor/Manual' },
    { id:'cb028', mfr:'Schneider Electric', model:'NSX1250HB2',          tech:'MCCB', kv:0.69, a:1250, icu:100, ics:100, icm:210, stkw:100, t_open:null,t_close:null,mech:'Motor/Manual' },
    { id:'cb029', mfr:'Eaton',              model:'NZM4 N 1250',         tech:'MCCB', kv:0.69, a:1250, icu:50,  ics:50,  icm:105, stkw:50,  t_open:null,t_close:null,mech:'Motor/Manual' },

    /* ── MV Vacuum CBs (VCB) 6-36 kV ───────────────────── */
    { id:'cb040', mfr:'ABB',                model:'VD4 12-25-630',       tech:'VCB',  kv:12,  a:630,  icu:25,  ics:25,  icm:63,  stkw:25,  t_open:55, t_close:65,  mech:'Spring' },
    { id:'cb041', mfr:'ABB',                model:'VD4 12-40-2500',      tech:'VCB',  kv:12,  a:2500, icu:40,  ics:40,  icm:100, stkw:40,  t_open:55, t_close:65,  mech:'Spring' },
    { id:'cb042', mfr:'ABB',                model:'VD4 17.5-40-3150',    tech:'VCB',  kv:17.5,a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:50, t_close:60,  mech:'Spring' },
    { id:'cb043', mfr:'ABB',                model:'VD4 24-40-1600',      tech:'VCB',  kv:24,  a:1600, icu:40,  ics:40,  icm:100, stkw:40,  t_open:55, t_close:65,  mech:'Spring' },
    { id:'cb044', mfr:'ABB',                model:'VD4 36-25-1250',      tech:'VCB',  kv:36,  a:1250, icu:25,  ics:25,  icm:63,  stkw:25,  t_open:60, t_close:70,  mech:'Spring' },
    { id:'cb045', mfr:'Siemens',            model:'SION 3AE5 12-40-1250',tech:'VCB',  kv:12,  a:1250, icu:40,  ics:40,  icm:100, stkw:40,  t_open:50, t_close:60,  mech:'Spring' },
    { id:'cb046', mfr:'Siemens',            model:'NXAIR 3AH5 17.5-50',  tech:'VCB',  kv:17.5,a:4000, icu:50,  ics:50,  icm:125, stkw:50,  t_open:45, t_close:55,  mech:'Spring' },
    { id:'cb047', mfr:'Siemens',            model:'3AH3 36-25',          tech:'VCB',  kv:36,  a:2500, icu:25,  ics:25,  icm:63,  stkw:25,  t_open:65, t_close:75,  mech:'Spring' },
    { id:'cb048', mfr:'Schneider Electric', model:'Evolis 12-40-2500',   tech:'VCB',  kv:12,  a:2500, icu:40,  ics:40,  icm:100, stkw:40,  t_open:48, t_close:58,  mech:'Spring' },
    { id:'cb049', mfr:'Schneider Electric', model:'HVX 17.5-40-3150',    tech:'VCB',  kv:17.5,a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:48, t_close:55,  mech:'Spring' },
    { id:'cb050', mfr:'Schneider Electric', model:'Fluarc FG2 36-25',    tech:'VCB',  kv:36,  a:2500, icu:25,  ics:25,  icm:63,  stkw:25,  t_open:52, t_close:68,  mech:'Spring' },
    { id:'cb051', mfr:'Eaton',              model:'VCP-W 15-40-2500',    tech:'VCB',  kv:15,  a:2500, icu:40,  ics:40,  icm:100, stkw:40,  t_open:50, t_close:60,  mech:'Spring' },
    { id:'cb052', mfr:'Eaton',              model:'VCP-W 38-25-2000',    tech:'VCB',  kv:38,  a:2000, icu:25,  ics:25,  icm:63,  stkw:25,  t_open:55, t_close:65,  mech:'Spring' },

    /* ── HV SF6 Gas Circuit Breakers >36 kV ─────────────── */
    { id:'cb060', mfr:'ABB',                model:'LTB 72.5E1',          tech:'SF6',  kv:72.5, a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:25, t_close:55,  mech:'Spring' },
    { id:'cb061', mfr:'ABB',                model:'LTB 145D1/B',         tech:'SF6',  kv:145,  a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:25, t_close:55,  mech:'Spring' },
    { id:'cb062', mfr:'ABB',                model:'LTB 245E1',           tech:'SF6',  kv:245,  a:4000, icu:50,  ics:50,  icm:125, stkw:50,  t_open:22, t_close:50,  mech:'Spring' },
    { id:'cb063', mfr:'ABB',                model:'LTB 420D1/B',         tech:'SF6',  kv:420,  a:4000, icu:63,  ics:63,  icm:170, stkw:63,  t_open:20, t_close:48,  mech:'Spring' },
    { id:'cb064', mfr:'Siemens',            model:'3AP1 FG 72.5',        tech:'SF6',  kv:72.5, a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:23, t_close:52,  mech:'Spring' },
    { id:'cb065', mfr:'Siemens',            model:'3AP1 FG 145',         tech:'SF6',  kv:145,  a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:23, t_close:52,  mech:'Spring' },
    { id:'cb066', mfr:'Siemens',            model:'3AP2 FI 245',         tech:'SF6',  kv:245,  a:4000, icu:63,  ics:63,  icm:158, stkw:63,  t_open:20, t_close:48,  mech:'Spring' },
    { id:'cb067', mfr:'Siemens',            model:'3AP2 FI 420',         tech:'SF6',  kv:420,  a:5000, icu:63,  ics:63,  icm:170, stkw:63,  t_open:18, t_close:45,  mech:'Spring' },
    { id:'cb068', mfr:'Schneider Electric', model:'GL312F 145',          tech:'SF6',  kv:145,  a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:24, t_close:55,  mech:'Spring' },
    { id:'cb069', mfr:'Schneider Electric', model:'GL314F 245',          tech:'SF6',  kv:245,  a:4000, icu:50,  ics:50,  icm:125, stkw:50,  t_open:22, t_close:52,  mech:'Spring' },
    { id:'cb070', mfr:'GE Vernova',         model:'DBTF 72.5',           tech:'SF6',  kv:72.5, a:3150, icu:40,  ics:40,  icm:100, stkw:40,  t_open:24, t_close:54,  mech:'Spring' },
    { id:'cb071', mfr:'GE Vernova',         model:'DBTF 145',            tech:'SF6',  kv:145,  a:4000, icu:50,  ics:50,  icm:125, stkw:50,  t_open:22, t_close:50,  mech:'Spring' },
    { id:'cb072', mfr:'GE Vernova',         model:'DBTF 245',            tech:'SF6',  kv:245,  a:4000, icu:63,  ics:63,  icm:158, stkw:63,  t_open:20, t_close:48,  mech:'Spring' },
    { id:'cb073', mfr:'GE Vernova',         model:'DBTF 420',            tech:'SF6',  kv:420,  a:5000, icu:63,  ics:63,  icm:170, stkw:63,  t_open:18, t_close:45,  mech:'Spring' },
  ],

  /* ═══════════════════════════════════════════════════════
     DISCONNECTORS / ISOLATORS
     Columns: mfr, model, type, kv, a, stkw, peak, ins_kv, mech
     ═══════════════════════════════════════════════════════ */
  disconnectors: [
    { id:'ds001', mfr:'ABB',                model:'SGC 12 1250A',        type:'Indoor',  kv:12,  a:1250, stkw:25, peak:63,  ins_kv:28,  mech:'Manual/Motor' },
    { id:'ds002', mfr:'ABB',                model:'SGC 12 2000A',        type:'Indoor',  kv:12,  a:2000, stkw:31.5,peak:80, ins_kv:28,  mech:'Manual/Motor' },
    { id:'ds003', mfr:'ABB',                model:'SDF 36 2000A',        type:'Indoor',  kv:36,  a:2000, stkw:25, peak:63,  ins_kv:70,  mech:'Motor' },
    { id:'ds004', mfr:'ABB',                model:'SGF 72.5',            type:'Outdoor', kv:72.5,a:2000, stkw:31.5,peak:80, ins_kv:170, mech:'Motor' },
    { id:'ds005', mfr:'ABB',                model:'SGF 145',             type:'Outdoor', kv:145, a:3150, stkw:40, peak:100, ins_kv:275, mech:'Motor' },
    { id:'ds006', mfr:'ABB',                model:'SGF 245',             type:'Outdoor', kv:245, a:4000, stkw:50, peak:125, ins_kv:460, mech:'Motor' },
    { id:'ds007', mfr:'ABB',                model:'SGF 420',             type:'Outdoor', kv:420, a:4000, stkw:63, peak:170, ins_kv:900, mech:'Motor' },
    { id:'ds008', mfr:'Siemens',            model:'3DC 12 1250A',        type:'Indoor',  kv:12,  a:1250, stkw:25, peak:63,  ins_kv:28,  mech:'Manual/Motor' },
    { id:'ds009', mfr:'Siemens',            model:'3DC 36 2000A',        type:'Indoor',  kv:36,  a:2000, stkw:25, peak:63,  ins_kv:70,  mech:'Motor' },
    { id:'ds010', mfr:'Siemens',            model:'3DE 72.5',            type:'Outdoor', kv:72.5,a:2500, stkw:31.5,peak:80, ins_kv:170, mech:'Motor' },
    { id:'ds011', mfr:'Siemens',            model:'3DE 145',             type:'Outdoor', kv:145, a:3150, stkw:40, peak:100, ins_kv:275, mech:'Motor' },
    { id:'ds012', mfr:'Siemens',            model:'3DE 245',             type:'Outdoor', kv:245, a:4000, stkw:63, peak:158, ins_kv:460, mech:'Motor' },
    { id:'ds013', mfr:'Siemens',            model:'3DE 420',             type:'Outdoor', kv:420, a:5000, stkw:63, peak:170, ins_kv:900, mech:'Motor' },
    { id:'ds014', mfr:'Schneider Electric', model:'INS 12 1250A',        type:'Indoor',  kv:12,  a:1250, stkw:25, peak:63,  ins_kv:28,  mech:'Manual/Motor' },
    { id:'ds015', mfr:'Schneider Electric', model:'INS 36 2000A',        type:'Indoor',  kv:36,  a:2000, stkw:25, peak:63,  ins_kv:70,  mech:'Motor' },
    { id:'ds016', mfr:'Schneider Electric', model:'GOAB 145',            type:'Outdoor', kv:145, a:3150, stkw:40, peak:100, ins_kv:275, mech:'Motor' },
    { id:'ds017', mfr:'Eaton',              model:'GL 12 1250A',         type:'Indoor',  kv:12,  a:1250, stkw:25, peak:63,  ins_kv:28,  mech:'Manual/Motor' },
    { id:'ds018', mfr:'Eaton',              model:'GL 36 1600A',         type:'Indoor',  kv:36,  a:1600, stkw:25, peak:63,  ins_kv:70,  mech:'Motor' },
    { id:'ds019', mfr:'Eaton',              model:'V-S 145',             type:'Outdoor', kv:145, a:2500, stkw:40, peak:100, ins_kv:275, mech:'Motor' },
  ],

  /* ═══════════════════════════════════════════════════════
     FUSES
     Columns: mfr, model, type, kv, a, icu, i2t_min, i2t_max, fuse_class
     ═══════════════════════════════════════════════════════ */
  fuses: [
    /* MV HRC Back-up Fuses (IEC 60282-1) */
    { id:'fu001', mfr:'ABB',                model:'CMF 12 2A',      type:'HRC', kv:12,  a:2,   icu:50, i2t_min:0.05,  i2t_max:1,      fuse_class:'Back-up' },
    { id:'fu002', mfr:'ABB',                model:'CMF 12 6.3A',    type:'HRC', kv:12,  a:6.3, icu:50, i2t_min:2.5,   i2t_max:30,     fuse_class:'Back-up' },
    { id:'fu003', mfr:'ABB',                model:'CMF 12 16A',     type:'HRC', kv:12,  a:16,  icu:50, i2t_min:15,    i2t_max:180,    fuse_class:'Back-up' },
    { id:'fu004', mfr:'ABB',                model:'CMF 12 25A',     type:'HRC', kv:12,  a:25,  icu:50, i2t_min:45,    i2t_max:500,    fuse_class:'Back-up' },
    { id:'fu005', mfr:'ABB',                model:'CMF 12 40A',     type:'HRC', kv:12,  a:40,  icu:50, i2t_min:115,   i2t_max:1350,   fuse_class:'Back-up' },
    { id:'fu006', mfr:'ABB',                model:'CMF 12 63A',     type:'HRC', kv:12,  a:63,  icu:50, i2t_min:280,   i2t_max:3200,   fuse_class:'Back-up' },
    { id:'fu007', mfr:'ABB',                model:'CMF 12 100A',    type:'HRC', kv:12,  a:100, icu:50, i2t_min:700,   i2t_max:8000,   fuse_class:'Back-up' },
    { id:'fu008', mfr:'ABB',                model:'CEF 36 40A',     type:'HRC', kv:36,  a:40,  icu:40, i2t_min:130,   i2t_max:1500,   fuse_class:'Back-up' },
    { id:'fu009', mfr:'ABB',                model:'CEF 36 63A',     type:'HRC', kv:36,  a:63,  icu:40, i2t_min:320,   i2t_max:3500,   fuse_class:'Back-up' },
    { id:'fu010', mfr:'Siemens',            model:'3GD1 12 6.3A',   type:'HRC', kv:12,  a:6.3, icu:50, i2t_min:2.8,   i2t_max:32,     fuse_class:'Back-up' },
    { id:'fu011', mfr:'Siemens',            model:'3GD1 12 25A',    type:'HRC', kv:12,  a:25,  icu:50, i2t_min:48,    i2t_max:520,    fuse_class:'Back-up' },
    { id:'fu012', mfr:'Siemens',            model:'3GD1 12 63A',    type:'HRC', kv:12,  a:63,  icu:50, i2t_min:300,   i2t_max:3400,   fuse_class:'Back-up' },
    { id:'fu013', mfr:'Siemens',            model:'3GD1 12 100A',   type:'HRC', kv:12,  a:100, icu:50, i2t_min:750,   i2t_max:8500,   fuse_class:'Back-up' },
    { id:'fu014', mfr:'Siemens',            model:'3GD2 36 50A',    type:'HRC', kv:36,  a:50,  icu:40, i2t_min:190,   i2t_max:2100,   fuse_class:'Back-up' },
    { id:'fu015', mfr:'Schneider Electric', model:'Fusarc CF 12 6A',type:'HRC', kv:12,  a:6,   icu:50, i2t_min:2.4,   i2t_max:28,     fuse_class:'Back-up' },
    { id:'fu016', mfr:'Schneider Electric', model:'Fusarc CF 12 25A',type:'HRC',kv:12,  a:25,  icu:50, i2t_min:42,    i2t_max:480,    fuse_class:'Back-up' },
    { id:'fu017', mfr:'Schneider Electric', model:'Fusarc CF 12 63A',type:'HRC',kv:12,  a:63,  icu:50, i2t_min:270,   i2t_max:3100,   fuse_class:'Back-up' },
    { id:'fu018', mfr:'Schneider Electric', model:'Fusarc CF 12 100A',type:'HRC',kv:12, a:100, icu:50, i2t_min:680,   i2t_max:7800,   fuse_class:'Back-up' },
    { id:'fu019', mfr:'Eaton',              model:'Bussmann 12 6A',  type:'HRC', kv:12, a:6,   icu:50, i2t_min:2.6,   i2t_max:30,     fuse_class:'Back-up' },
    { id:'fu020', mfr:'Eaton',              model:'Bussmann 12 25A', type:'HRC', kv:12, a:25,  icu:50, i2t_min:46,    i2t_max:510,    fuse_class:'Back-up' },
    { id:'fu021', mfr:'Eaton',              model:'Bussmann 12 63A', type:'HRC', kv:12, a:63,  icu:50, i2t_min:290,   i2t_max:3300,   fuse_class:'Back-up' },
    { id:'fu022', mfr:'Eaton',              model:'Bussmann 12 100A',type:'HRC', kv:12, a:100, icu:50, i2t_min:720,   i2t_max:8200,   fuse_class:'Back-up' },
    { id:'fu023', mfr:'Eaton',              model:'Bussmann 12 200A',type:'HRC', kv:12, a:200, icu:50, i2t_min:2800,  i2t_max:32000,  fuse_class:'Full-range' },
  ],

  /* ═══════════════════════════════════════════════════════
     PROTECTION RELAYS
     Columns: mfr, model, code, function, ct_in, vt_in, bi, bo, comms, pickup_range, tms_range, curves
     ═══════════════════════════════════════════════════════ */
  protection_relays: [
    /* ABB */
    { id:'rl001', mfr:'ABB', model:'REF615',         code:'50/51',  fn:'Overcurrent',          ct_in:3,  vt_in:0, bi:8,  bo:6,  comms:'IEC 61850, Modbus, DNP3', pickup:'0.05–40×In',  tms:'0.05–1.0',   curves:'IEC SI/VI/EI/LTI, IEEE MI/VI/EI' },
    { id:'rl002', mfr:'ABB', model:'REF615',         code:'51N',    fn:'Earth Fault',           ct_in:3,  vt_in:0, bi:8,  bo:6,  comms:'IEC 61850, Modbus, DNP3', pickup:'0.01–8×In',   tms:'0.05–1.0',   curves:'IEC SI/VI/EI/LTI' },
    { id:'rl003', mfr:'ABB', model:'RED615',         code:'87',     fn:'Differential',          ct_in:6,  vt_in:0, bi:8,  bo:6,  comms:'IEC 61850, Modbus, DNP3', pickup:'0.1–1.0 pu',  tms:null,         curves:null },
    { id:'rl004', mfr:'ABB', model:'REL670',         code:'21',     fn:'Distance',              ct_in:3,  vt_in:4, bi:16, bo:12, comms:'IEC 61850, Modbus, DNP3', pickup:'Zone 1–5',    tms:'0–60 s',     curves:'Mho, Quad, Offset Mho' },
    { id:'rl005', mfr:'ABB', model:'REM615',         code:'50BF',   fn:'Breaker Failure',       ct_in:3,  vt_in:0, bi:8,  bo:6,  comms:'IEC 61850, Modbus',       pickup:'0.05–40×In',  tms:'0.05–1.5 s', curves:null },
    { id:'rl006', mfr:'ABB', model:'RET670',         code:'87T',    fn:'Transformer Diff',      ct_in:12, vt_in:0, bi:16, bo:12, comms:'IEC 61850, Modbus, DNP3', pickup:'0.1–2.0 pu',  tms:null,         curves:null },
    /* Siemens */
    { id:'rl010', mfr:'Siemens', model:'7SJ85',      code:'50/51',  fn:'Overcurrent',           ct_in:4,  vt_in:0, bi:7,  bo:5,  comms:'IEC 61850, Modbus, DNP3', pickup:'0.05–35×In',  tms:'0.05–1.0',   curves:'IEC SI/VI/EI/LTI, ANSI MI/VI/EI' },
    { id:'rl011', mfr:'Siemens', model:'7SJ85',      code:'51N',    fn:'Earth Fault',           ct_in:4,  vt_in:0, bi:7,  bo:5,  comms:'IEC 61850, Modbus, DNP3', pickup:'0.01–10×In',  tms:'0.05–1.0',   curves:'IEC SI/VI/EI/LTI' },
    { id:'rl012', mfr:'Siemens', model:'7UT87',      code:'87',     fn:'Differential',          ct_in:12, vt_in:4, bi:14, bo:10, comms:'IEC 61850, Modbus, DNP3', pickup:'0.1–2.0 pu',  tms:null,         curves:null },
    { id:'rl013', mfr:'Siemens', model:'7SA87',      code:'21',     fn:'Distance',              ct_in:4,  vt_in:4, bi:14, bo:10, comms:'IEC 61850, Modbus, DNP3', pickup:'Zone 1–5',    tms:'0–60 s',     curves:'Mho, Quad, Offset Mho' },
    { id:'rl014', mfr:'Siemens', model:'7VK87',      code:'87B',    fn:'Busbar Diff',           ct_in:24, vt_in:0, bi:32, bo:24, comms:'IEC 61850',               pickup:'0.1–2.0 pu',  tms:null,         curves:null },
    /* Schneider Electric */
    { id:'rl020', mfr:'Schneider Electric', model:'Sepam S80',  code:'50/51', fn:'Overcurrent', ct_in:3,  vt_in:0, bi:10, bo:5,  comms:'IEC 61850, Modbus',       pickup:'0.1–24×In',   tms:'0.05–1.0',   curves:'IEC SI/VI/EI/LTI, IEEE MI/VI/EI' },
    { id:'rl021', mfr:'Schneider Electric', model:'Sepam S87',  code:'87',    fn:'Differential',ct_in:6,  vt_in:0, bi:10, bo:5,  comms:'IEC 61850, Modbus',       pickup:'0.1–1.5 pu',  tms:null,         curves:null },
    { id:'rl022', mfr:'Schneider Electric', model:'MiCOM P443', code:'21',    fn:'Distance',    ct_in:3,  vt_in:4, bi:12, bo:8,  comms:'IEC 61850, Modbus, DNP3', pickup:'Zone 1–4',    tms:'0–100 s',    curves:'Mho, Quad' },
    { id:'rl023', mfr:'Schneider Electric', model:'Sepam S80',  code:'51N',   fn:'Earth Fault', ct_in:3,  vt_in:0, bi:10, bo:5,  comms:'IEC 61850, Modbus',       pickup:'0.01–8×In',   tms:'0.05–1.0',   curves:'IEC SI/VI/EI/LTI' },
    /* GE Vernova */
    { id:'rl030', mfr:'GE Vernova', model:'Multilin 750/760', code:'50/51', fn:'Overcurrent',  ct_in:4,  vt_in:0, bi:12, bo:8,  comms:'IEC 61850, Modbus, DNP3', pickup:'0.05–20×In',  tms:'0.05–1.0',   curves:'IEC SI/VI/EI/LTI, IEEE U1–U5' },
    { id:'rl031', mfr:'GE Vernova', model:'Multilin 845',     code:'87',    fn:'Differential', ct_in:12, vt_in:4, bi:16, bo:10, comms:'IEC 61850, Modbus, DNP3', pickup:'0.1–2.0 pu',  tms:null,         curves:null },
    { id:'rl032', mfr:'GE Vernova', model:'Multilin D60',     code:'21',    fn:'Distance',     ct_in:4,  vt_in:4, bi:16, bo:12, comms:'IEC 61850, Modbus, DNP3', pickup:'Zone 1–5',    tms:'0–100 s',    curves:'Mho, Quad, Reactance' },
    { id:'rl033', mfr:'GE Vernova', model:'Multilin F35',     code:'50BF',  fn:'Breaker Fail', ct_in:4,  vt_in:0, bi:8,  bo:6,  comms:'IEC 61850, Modbus',       pickup:'0.05–20×In',  tms:'0.1–2.0 s',  curves:null },
  ],

  /* ═══════════════════════════════════════════════════════
     CURRENT TRANSFORMERS
     ═══════════════════════════════════════════════════════ */
  current_transformers: [
    { id:'ct001', mfr:'ABB',                model:'TPU 24 100/5',      kv:24,  ip:100,  is:5, class:'0.5/5P20', burden:15, alf:20, thermal:12.5, dynamic:31.5 },
    { id:'ct002', mfr:'ABB',                model:'TPU 24 200/5',      kv:24,  ip:200,  is:5, class:'0.5/5P20', burden:15, alf:20, thermal:25,   dynamic:63 },
    { id:'ct003', mfr:'ABB',                model:'TPU 24 400/5',      kv:24,  ip:400,  is:5, class:'0.5/5P20', burden:20, alf:20, thermal:31.5, dynamic:80 },
    { id:'ct004', mfr:'ABB',                model:'TPU 24 600/5',      kv:24,  ip:600,  is:5, class:'0.5/5P20', burden:30, alf:20, thermal:40,   dynamic:100 },
    { id:'ct005', mfr:'ABB',                model:'IMB 145 1200/5',    kv:145, ip:1200, is:5, class:'0.2/5P20', burden:30, alf:20, thermal:40,   dynamic:100 },
    { id:'ct006', mfr:'ABB',                model:'IMB 245 2000/5',    kv:245, ip:2000, is:5, class:'0.2/5P20', burden:50, alf:20, thermal:50,   dynamic:125 },
    { id:'ct007', mfr:'Siemens',            model:'4MA72 100/5',       kv:24,  ip:100,  is:5, class:'0.5/5P20', burden:15, alf:20, thermal:12.5, dynamic:31.5 },
    { id:'ct008', mfr:'Siemens',            model:'4MA72 400/5',       kv:24,  ip:400,  is:5, class:'0.5/5P20', burden:20, alf:20, thermal:25,   dynamic:63 },
    { id:'ct009', mfr:'Siemens',            model:'4MA72 800/5',       kv:24,  ip:800,  is:5, class:'0.5/5P20', burden:30, alf:20, thermal:40,   dynamic:100 },
    { id:'ct010', mfr:'Siemens',            model:'4MC85 1500/5',      kv:145, ip:1500, is:5, class:'0.2/5P20', burden:30, alf:20, thermal:40,   dynamic:100 },
    { id:'ct011', mfr:'Siemens',            model:'4MC85 2500/5',      kv:245, ip:2500, is:5, class:'0.2/5P20', burden:50, alf:20, thermal:63,   dynamic:158 },
    { id:'ct012', mfr:'Schneider Electric', model:'IOSK 100/5',        kv:24,  ip:100,  is:5, class:'0.5/5P20', burden:15, alf:20, thermal:12.5, dynamic:31.5 },
    { id:'ct013', mfr:'Schneider Electric', model:'IOSK 400/5',        kv:24,  ip:400,  is:5, class:'0.5/5P20', burden:15, alf:20, thermal:25,   dynamic:63 },
    { id:'ct014', mfr:'Schneider Electric', model:'OSKF 145 1200/5',   kv:145, ip:1200, is:5, class:'0.2/5P20', burden:30, alf:20, thermal:40,   dynamic:100 },
    { id:'ct015', mfr:'GE Vernova',         model:'JAK-12 100/5',      kv:15,  ip:100,  is:5, class:'0.3/5P20', burden:15, alf:20, thermal:12.5, dynamic:31.5 },
    { id:'ct016', mfr:'GE Vernova',         model:'JAK-12 600/5',      kv:15,  ip:600,  is:5, class:'0.3/5P20', burden:30, alf:20, thermal:40,   dynamic:100 },
    { id:'ct017', mfr:'GE Vernova',         model:'IFK 145 2000/5',    kv:145, ip:2000, is:5, class:'0.2/5P20', burden:50, alf:20, thermal:50,   dynamic:125 },
  ],

  /* ═══════════════════════════════════════════════════════
     VOLTAGE TRANSFORMERS
     ═══════════════════════════════════════════════════════ */
  voltage_transformers: [
    { id:'vt001', mfr:'ABB',                model:'TJP6 11/0.11',     type:'Wound',     kv_p:11,   kv_s_v:110, class:'0.5/3P', burden:50,  vf:'1.2/30s', ins_kv:28 },
    { id:'vt002', mfr:'ABB',                model:'TJP6 33/0.11',     type:'Wound',     kv_p:33,   kv_s_v:110, class:'0.5/3P', burden:50,  vf:'1.2/30s', ins_kv:70 },
    { id:'vt003', mfr:'ABB',                model:'EMF 145/0.11',     type:'Inductive', kv_p:132,  kv_s_v:110, class:'0.2/3P', burden:100, vf:'1.5/30s', ins_kv:275 },
    { id:'vt004', mfr:'ABB',                model:'CVT 245',          type:'CVT',       kv_p:220,  kv_s_v:110, class:'0.5/3P', burden:200, vf:'1.5/30s', ins_kv:460 },
    { id:'vt005', mfr:'ABB',                model:'CVT 420',          type:'CVT',       kv_p:400,  kv_s_v:110, class:'0.5/3P', burden:200, vf:'1.5/30s', ins_kv:900 },
    { id:'vt006', mfr:'Siemens',            model:'4MR14 11/0.11',    type:'Wound',     kv_p:11,   kv_s_v:110, class:'0.5/3P', burden:50,  vf:'1.2/30s', ins_kv:28 },
    { id:'vt007', mfr:'Siemens',            model:'4MR14 33/0.11',    type:'Wound',     kv_p:33,   kv_s_v:110, class:'0.5/3P', burden:50,  vf:'1.2/30s', ins_kv:70 },
    { id:'vt008', mfr:'Siemens',            model:'4MU55 132/0.11',   type:'Inductive', kv_p:132,  kv_s_v:110, class:'0.2/3P', burden:100, vf:'1.5/30s', ins_kv:275 },
    { id:'vt009', mfr:'Siemens',            model:'4MC4 220/0.11',    type:'CVT',       kv_p:220,  kv_s_v:110, class:'0.5/3P', burden:200, vf:'1.5/30s', ins_kv:460 },
    { id:'vt010', mfr:'Schneider Electric', model:'VRQ2 11/0.11',     type:'Wound',     kv_p:11,   kv_s_v:110, class:'0.5/3P', burden:50,  vf:'1.2/30s', ins_kv:28 },
    { id:'vt011', mfr:'Schneider Electric', model:'VRQ2 33/0.11',     type:'Wound',     kv_p:33,   kv_s_v:110, class:'0.5/3P', burden:50,  vf:'1.2/30s', ins_kv:70 },
    { id:'vt012', mfr:'Schneider Electric', model:'VIP 145/0.11',     type:'Inductive', kv_p:132,  kv_s_v:110, class:'0.2/3P', burden:100, vf:'1.5/30s', ins_kv:275 },
    { id:'vt013', mfr:'GE Vernova',         model:'JVT-150 11/0.11',  type:'Wound',     kv_p:11,   kv_s_v:110, class:'0.3/3P', burden:50,  vf:'1.2/30s', ins_kv:28 },
    { id:'vt014', mfr:'GE Vernova',         model:'JVT-150 33/0.11',  type:'Wound',     kv_p:33,   kv_s_v:110, class:'0.3/3P', burden:50,  vf:'1.2/30s', ins_kv:70 },
    { id:'vt015', mfr:'GE Vernova',         model:'JVTF-145 132/0.11',type:'Inductive', kv_p:132,  kv_s_v:110, class:'0.2/3P', burden:100, vf:'1.5/30s', ins_kv:275 },
    { id:'vt016', mfr:'GE Vernova',         model:'CVT-245 220/0.11', type:'CVT',       kv_p:220,  kv_s_v:110, class:'0.5/3P', burden:200, vf:'1.5/30s', ins_kv:460 },
  ],
};

/* ── Voltage class helpers ── */
function getCBVoltageClass(kv) {
  if (kv <= 1)   return 'LVCB';
  if (kv <= 36)  return 'MVCB';
  return 'HVCB';
}

function filterCBByVoltageClass(cls) {
  const ranges = { LVCB: [0, 1], MVCB: [1, 36.001], HVCB: [36.001, Infinity] };
  const [lo, hi] = ranges[cls] || [0, Infinity];
  return CATALOGUE.circuit_breakers.filter(cb => cb.kv > lo && cb.kv <= hi);
}
