/**
 * DUMMY DATA SEED UNTUK APLIKASI ABSENSI & CUTI KARYAWAN
 */

const DEFAULT_OFFICE_SETTINGS = {
  companyName: "PT ANUGERAH BERKAH INDUSTRI",
  companyLogo: "logo.jpg",
  workStart: "07:50",
  workEnd: "17:00",
  officeLatitude: -6.243679,      // Masukkan Latitude kantor Anda
  officeLongitude: 106.427823,    // Masukkan Longitude kantor Anda
  allowedRadiusMeters: 10,     // Radius dalam meter
  strictGps: false,
  defaultAnnualLeaveQuota: 12,
  // Tempelkan URL Web App Google Apps Script di sini agar otomatis aktif di seluruh HP karyawan
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyYg4WkJ912lWos4jfjVCy4IJBx0zS8Ch4CyEwkf5u1Z9OQ1CLYqVGINBkhr90l91d0/exec"
};

const DEFAULT_EMPLOYEES = [
  {
    id: "ABR-001",
    nip: "11001",
    name: "AHMAD JOHARI",
    email: "11001@perusahaan.com",
    department: "Produksi",
    position: "Kor. Bulb",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Ahmad+Johari&background=2563eb&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11001",
    role: "employee"
  },
  {
    id: "ABR-002",
    nip: "11002",
    name: "SUHADI",
    email: "11002@perusahaan.com",
    department: "Produksi",
    position: "Kor. Blader",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Suhadi&background=0284c7&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11002",
    role: "employee"
  },
  {
    id: "ABR-003",
    nip: "11003",
    name: "BAMBANG SETIAWAN",
    email: "11003@perusahaan.com",
    department: "Produksi",
    position: "Kor. Bulb",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Bambang+Setiawan&background=0d9488&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11003",
    role: "employee"
  },
  {
    id: "ABR-004",
    nip: "11004",
    name: "SUTARJO",
    email: "11004@perusahaan.com",
    department: "MTC",
    position: "MTC",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Sutarjo&background=4f46e5&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11004",
    role: "employee"
  },
  {
    id: "ABR-005",
    nip: "11005",
    name: "WAHYUDIN",
    email: "11005@perusahaan.com",
    department: "Produksi",
    position: "Kep. Prod 2",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Wahyudin&background=7c3aed&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11005",
    role: "employee"
  },
  {
    id: "ABR-006",
    nip: "11006",
    name: "AHMAD RIFAI",
    email: "11006@perusahaan.com",
    department: "Mixing",
    position: "Mixing",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Ahmad+Rifai&background=c026d3&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11006",
    role: "employee"
  },
  {
    id: "ABR-007",
    nip: "11007",
    name: "MUHAMAD RIFAI",
    email: "11007@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Muhamad+Rifai&background=db2777&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11007",
    role: "employee"
  },
  {
    id: "ABR-009",
    nip: "11009",
    name: "IWAN",
    email: "11009@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Iwan&background=e11d48&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11009",
    role: "employee"
  },
  {
    id: "ABR-011",
    nip: "11011",
    name: "WAHYUDI",
    email: "11011@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Wahyudi&background=ea580c&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11011",
    role: "employee"
  },
  {
    id: "ABR-012",
    nip: "11012",
    name: "MUHAMAD NURJEN",
    email: "11012@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Muhamad+Nurjen&background=d97706&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11012",
    role: "employee"
  },
  {
    id: "ABR-013",
    nip: "11013",
    name: "AKHMAD SOLEH",
    email: "11013@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Akhmad+Soleh&background=ca8a04&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11013",
    role: "employee"
  },
  {
    id: "ABR-014",
    nip: "11014",
    name: "AHMAD FAHMI",
    email: "11014@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Ahmad+Fahmi&background=65a30d&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11014",
    role: "employee"
  },
  {
    id: "ABR-015",
    nip: "11015",
    name: "MUALIM",
    email: "11015@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Mualim&background=16a34a&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11015",
    role: "employee"
  },
  {
    id: "ABR-016",
    nip: "11016",
    name: "EKO SUPRAYITNO",
    email: "11016@perusahaan.com",
    department: "QC",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Eko+Suprayitno&background=059669&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11016",
    role: "employee"
  },
  {
    id: "ABR-018",
    nip: "11018",
    name: "AGUS SUTRISNO",
    email: "11018@perusahaan.com",
    department: "Finance",
    position: "Eksim & Purchase",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Agus+Sutrisno&background=0891b2&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11018",
    role: "employee"
  },
  {
    id: "ABR-019",
    nip: "11019",
    name: "MULADI",
    email: "11019@perusahaan.com",
    department: "QC",
    position: "Kep. QC & PPIC",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Muladi&background=2563eb&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11019",
    role: "employee"
  },
  {
    id: "ABR-020",
    nip: "11020",
    name: "ROHAMI",
    email: "11020@perusahaan.com",
    department: "QC",
    position: "Kor. QC",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Rohami&background=4f46e5&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11020",
    role: "employee"
  },
  {
    id: "ABR-021",
    nip: "11021",
    name: "FAHRUL IRGI FAHREZI",
    email: "11021@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Fahrul+Irgi&background=7c3aed&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11021",
    role: "employee"
  },
  {
    id: "ABR-026",
    nip: "11026",
    name: "AGUS NURHIDAYAT",
    email: "11026@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Agus+Nurhidayat&background=9333ea&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11026",
    role: "employee"
  },
  {
    id: "ABR-027",
    nip: "11027",
    name: "M AHABUDIN",
    email: "11027@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=M+Ahabudin&background=c026d3&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11027",
    role: "employee"
  },
  {
    id: "ABR-028",
    nip: "11028",
    name: "JAYADI",
    email: "11028@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Jayadi&background=db2777&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11028",
    role: "employee"
  },
  {
    id: "ABR-030",
    nip: "11030",
    name: "HERI FIRDAUS",
    email: "11030@perusahaan.com",
    department: "CS",
    position: "CS",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Heri+Firdaus&background=e11d48&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11030",
    role: "employee"
  },
  {
    id: "ABR-033",
    nip: "11033",
    name: "ARYONO",
    email: "11033@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Aryono&background=ea580c&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11033",
    role: "employee"
  },
  {
    id: "ABR-034",
    nip: "11034",
    name: "ALIFIA NURUS SAHARANI",
    email: "11034@perusahaan.com",
    department: "QC",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Alifia+Nurus&background=d97706&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11034",
    role: "employee"
  },
  {
    id: "ABR-035",
    nip: "11035",
    name: "AHMAD MA'SUM",
    email: "11035@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Ahmad+Masum&background=ca8a04&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11035",
    role: "employee"
  },
  {
    id: "ABR-036",
    nip: "11036",
    name: "MUHAMMAD HANIF KEYLANI",
    email: "11036@perusahaan.com",
    department: "QC",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Muhammad+Hanif&background=65a30d&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11036",
    role: "employee"
  },
  {
    id: "ABR-037",
    nip: "11037",
    name: "MOCHAMAD DIO PUTRA DHARMAWAN",
    email: "11037@perusahaan.com",
    department: "Produksi",
    position: "Kep. Prod 1",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Mochamad+Dio&background=16a34a&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11037",
    role: "employee"
  },
  {
    id: "ABR-032",
    nip: "11032",
    name: "MITA SUCI ALIYIN",
    email: "11032@perusahaan.com",
    department: "Finance",
    position: "Admin & Keuangan",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Mita+Suci&background=0891b2&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11032",
    role: "employee"
  },
  {
    id: "ABR-038",
    nip: "11038",
    name: "NUR IQLIMA FITRIYANI",
    email: "11038@perusahaan.com",
    department: "QC",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Nur+Iqlima&background=0284c7&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11038",
    role: "employee"
  },
  {
    id: "ABR-039",
    nip: "11039",
    name: "ERWIN",
    email: "11039@perusahaan.com",
    department: "Keamanan",
    position: "Security",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Erwin&background=334155&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11039",
    role: "employee"
  },
  {
    id: "ABR-040",
    nip: "11040",
    name: "FAISAL",
    email: "11040@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Faisal&background=2563eb&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11040",
    role: "employee"
  },
  {
    id: "ABR-041",
    nip: "11041",
    name: "ERIN",
    email: "11041@perusahaan.com",
    department: "QC",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Erin&background=db2777&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11041",
    role: "employee"
  },
  {
    id: "ABR-042",
    nip: "11042",
    name: "FAJAR",
    email: "11042@perusahaan.com",
    department: "Produksi",
    position: "Operator",
    phone: "-",
    avatar: "https://ui-avatars.com/api/?name=Fajar&background=059669&color=fff&size=150",
    joinDate: "2024-01-01",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "11042",
    role: "employee"
  },
  {
    id: "ABR-024",
    nip: "11024",
    name: "MOCH TAUFIK ROMDHONI",
    email: "romdhoni.taufik@gmail.com",
    department: "Human Resources (HRD)",
    position: "HR & People Ops Manager",
    phone: "089512237938",
    avatar: "https://ui-avatars.com/api/?name=Moch+Taufik&background=4338ca&color=fff&size=150",
    joinDate: "2023-02-15",
    leaveQuota: { total: 12, used: 0, remaining: 12 },
    pin: "user@123",
    role: "admin"
  }
];

// Helper to format date YYYY-MM-DD
function getRecentDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Generate realistic attendances over the last 30 days for 34 employees
function generateSeedAttendances() {
  const attendances = [];
  const empIds = [
    "ABR-001", "ABR-002", "ABR-003", "ABR-004", "ABR-005", "ABR-006",
    "ABR-007", "ABR-008", "ABR-009", "ABR-010", "ABR-011", "ABR-012",
    "ABR-013", "ABR-014", "ABR-015", "ABR-016", "ABR-017", "ABR-018",
    "ABR-019", "ABR-020", "ABR-021", "ABR-022", "ABR-023", "ABR-024"
  ];

  let attCounter = 1000;

  // Generate for past 30 days (daysAgo 1 to 30)
  for (let daysAgo = 1; daysAgo <= 30; daysAgo++) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dayOfWeek = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const dateStr = d.toISOString().split('T')[0];

    // On Sundays, only few employees work overtime shift
    const activeEmps = (dayOfWeek === 0)
      ? [empIds[daysAgo % empIds.length], empIds[(daysAgo + 3) % empIds.length]]
      : (dayOfWeek === 6)
        ? empIds.slice(0, 8) // Half team on Saturdays
        : empIds.slice(0, 16); // Normal weekdays

    activeEmps.forEach((empId, idx) => {
      attCounter++;
      const isLate = (idx % 7 === 0);
      const inHour = isLate ? "08:15" : "07:45";
      const inSec = String(10 + (idx * 3) % 45).padStart(2, '0');
      const clockIn = `${inHour}:${inSec}`;

      let clockOut = "17:00:00";
      let workHours = "9 Jam 0 Menit";
      let overtimeHours = "0 Jam";
      let overtimeDecimal = 0;

      if (dayOfWeek === 0) {
        // MINGGU: Seluruh jam kerja dihitung lembur
        clockOut = "16:00:00";
        workHours = "8 Jam 0 Menit";
        overtimeHours = "8 Jam";
        overtimeDecimal = 8;
      } else if (dayOfWeek === 6) {
        // SABTU: Jam 13:00 ke atas dihitung lembur (pembulatan 45 menit)
        if (idx % 2 === 0) {
          clockOut = "15:48:00"; // Lembur 2 jam 48 mnt (sisa 48 mnt >= 45 mnt -> dibulatkan jadi 3 Jam)
          workHours = "7 Jam 48 Menit";
          overtimeHours = "3 Jam";
          overtimeDecimal = 3;
        } else {
          clockOut = "13:30:00"; // Lembur 30 mnt (< 45 mnt -> tidak dihitung / 0 Jam)
          workHours = "5 Jam 30 Menit";
          overtimeHours = "0 Jam";
          overtimeDecimal = 0;
        }
      } else {
        // SENIN - JUMAT: Jam 17:00 ke atas dihitung lembur (pembulatan 45 menit)
        if (idx % 3 === 0) {
          clockOut = "19:46:00"; // Lembur 2 jam 46 mnt (sisa 46 mnt >= 45 mnt -> dibulatkan jadi 3 Jam)
          workHours = "11 Jam 46 Menit";
          overtimeHours = "3 Jam";
          overtimeDecimal = 3;
        } else if (idx % 4 === 0) {
          clockOut = "18:20:00"; // Lembur 1 jam 20 mnt (sisa 20 mnt < 45 mnt -> tetap 1 Jam)
          workHours = "10 Jam 20 Menit";
          overtimeHours = "1 Jam";
          overtimeDecimal = 1;
        } else {
          clockOut = "17:35:15"; // Lembur 35 mnt (< 45 mnt -> tidak dihitung / 0 Jam)
          workHours = "9 Jam 35 Menit";
          overtimeHours = "0 Jam";
          overtimeDecimal = 0;
        }
      }

      attendances.push({
        id: `ATT-${attCounter}`,
        employeeId: empId,
        date: dateStr,
        clockIn: clockIn,
        clockInStatus: isLate ? "Terlambat" : "Tepat Waktu",
        clockInLocation: {
          lat: -6.243679 + (idx * 0.00001),
          lng: 106.427823 + (idx * 0.00001),
          address: `Kantor Pusat ABI (WFO - Radius ${15 + (idx % 10)}m)`,
          inOfficeRadius: true,
          distanceMeters: 15 + (idx % 10)
        },
        clockInPhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
        clockOut: clockOut,
        clockOutLocation: {
          lat: -6.243679,
          lng: 106.427823,
          address: "Kantor Pusat ABI (WFO)",
          inOfficeRadius: true,
          distanceMeters: 15
        },
        workHours: workHours,
        overtimeHours: overtimeHours,
        overtimeDecimal: overtimeDecimal,
        status: "Hadir"
      });
    });
  }

  return attendances;
}

const DEFAULT_ATTENDANCES = []; // Dikosongkan (0 Jam Lembur) agar bersih untuk operasional karyawan asli PT ABI

const DEFAULT_REQUESTS = []; // Dikosongkan agar bersih untuk operasional karyawan asli PT ABI
