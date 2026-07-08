export type EmployeeType = 'Full-time' | 'Part time' | 'Intern' | 'Remote' | 'Hybrid';
export type EmployeeStatus = 'Active' | 'Retired' | 'Suspension' | 'Sacked' | 'Leave' | 'Resigned';

export type Employee = {
  id: string;
  name: string;
  email: string; // Used for search/detail views
  department: string;
  designation: string;
  type: EmployeeType;
  status: EmployeeStatus;
  avatar: string;
  active?: boolean;
  categories: string[];
  contract?: string;
  workload?: number;
};

export const mockEmployees: Employee[] = [
  {
    id: "345321231",
    name: "Darlene Robertson",
    email: "darlene@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Full-time",
    status: "Retired",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Darlene",
    active: false,
    categories: ["service"],
    contract: "hourly",
    workload: 0,
  },
  {
    id: "345321232",
    name: "Jacob Jones",
    email: "jacob@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Intern",
    status: "Active",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Jacob",
    active: true,
    categories: ["kitchen"],
    contract: "monthly",
    workload: 100,
  },
  {
    id: "345321233",
    name: "Kathryn Murphy",
    email: "kathryn@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Full-time",
    status: "Suspension",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Kathryn",
    active: false,
    categories: ["service", "bar"],
    contract: "monthly",
    workload: 100,
  },
  {
    id: "345321234",
    name: "Eleanor Pena",
    email: "eleanor@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Part time",
    status: "Sacked",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Eleanor",
    active: false,
    categories: ["office"],
    contract: "hourly",
    workload: 50,
  },
  {
    id: "345321235",
    name: "Courtney Henry",
    email: "courtney@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Remote",
    status: "Active",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Courtney",
    active: true,
    categories: ["bar"],
    contract: "monthly",
    workload: 80,
  },
  {
    id: "345321236",
    name: "Albert Flores",
    email: "albert@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Hybrid",
    status: "Leave",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Albert",
    active: true,
    categories: ["kitchen", "dishwashing"],
    contract: "hourly",
    workload: 60,
  },
  {
    id: "345321237",
    name: "Bessie Cooper",
    email: "bessie@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Part time",
    status: "Suspension",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Bessie",
    active: false,
    categories: ["service"],
    contract: "hourly",
    workload: 40,
  },
  {
    id: "345321238",
    name: "Guy Hawkins",
    email: "guy@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Full-time",
    status: "Resigned",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Guy",
    active: false,
    categories: ["commande"],
    contract: "monthly",
    workload: 100,
  },
  {
    id: "345321239",
    name: "Savannah Nguyen",
    email: "savannah@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Remote",
    status: "Active",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Savannah",
    active: true,
    categories: ["service", "office"],
    contract: "monthly",
    workload: 100,
  },
  {
    id: "345321240",
    name: "Ronald Richards",
    email: "ronald@example.com",
    department: "Design",
    designation: "UI/UX Designer",
    type: "Intern",
    status: "Leave",
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=Ronald",
    active: true,
    categories: ["kitchen"],
    contract: "hourly",
    workload: 100,
  },
];

export const employees = mockEmployees;

export const departments = ["Design", "Engineering", "Marketing", "HR", "Finance"];
export const designations = ["UI/UX Designer", "Frontend Dev", "Backend Dev", "Manager", "Analyst"];

export type Category = {
  id: string;
  name: string;
  sub?: string[];
};

export const categories: Category[] = [
  { id: "service", name: "Service", sub: ["Runner", "Chef de Rang", "Commis"] },
  { id: "kitchen", name: "Kitchen", sub: ["Grill", "Entremetier", "Garde Manger"] },
  { id: "bar", name: "Bar", sub: ["Cocktails", "Service Bar"] },
  { id: "office", name: "Office", sub: ["Admin", "Reception"] },
  { id: "commande", name: "Commande", sub: [] },
  { id: "dishwashing", name: "Dishwashing", sub: [] },
];

export const weeks = [
  { id: "w1", label: "Week 1", range: "Nov 3 - Nov 9", status: "published" },
  { id: "w2", label: "Week 2", range: "Nov 10 - Nov 16", status: "submitted" },
  { id: "w3", label: "Week 3", range: "Nov 17 - Nov 23", status: "draft" },
  { id: "w4", label: "Week 4", range: "Nov 24 - Nov 30", status: "draft" },
] as const;

export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const currentMonth = "November 2026";

export const getAvailability = (empId: string, dayIdx: number) => {
  const v = (empId.charCodeAt(0) + dayIdx) % 7;
  if (v === 0) return "unavailable";
  if (v === 1) return "wish";
  return "available";
};

export const submittedAvailability = { submitted: 4, total: 10 };
export const notSubmitted = ["345321235", "345321236", "345321232", "345321239", "345321240", "345321237"];

export type SwapRequest = {
  id: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  fromShift: { day: string; time: string; category: string };
  toShift: { day: string; time: string; category: string };
  status: "pending" | "approved" | "rejected";
  ruleCheck: "pass" | "fail";
  ruleNote?: string;
  requestedAt: string;
};

export const swapRequests: SwapRequest[] = [
  {
    id: "swap-1",
    fromEmployeeId: "345321232",
    toEmployeeId: "345321235",
    fromShift: { day: "Fri, Nov 21", time: "10:00 - 18:00", category: "Kitchen" },
    toShift: { day: "Fri, Nov 21", time: "18:00 - 02:00", category: "Kitchen" },
    status: "pending",
    ruleCheck: "pass",
    requestedAt: "2h ago",
  },
  {
    id: "swap-2",
    fromEmployeeId: "345321239",
    toEmployeeId: "345321240",
    fromShift: { day: "Sat, Nov 22", time: "14:00 - 23:00", category: "Service" },
    toShift: { day: "Sun, Nov 23", time: "10:00 - 18:00", category: "Service" },
    status: "pending",
    ruleCheck: "fail",
    ruleNote: "Fails L-GAV minimum 11h rest period. Employee would have only 9h rest.",
    requestedAt: "5h ago",
  },
  {
    id: "swap-3",
    fromEmployeeId: "345321235",
    toEmployeeId: "345321236",
    fromShift: { day: "Mon, Nov 17", time: "10:00 - 15:00", category: "Bar" },
    toShift: { day: "Mon, Nov 17", time: "15:00 - 23:00", category: "Bar" },
    status: "approved",
    ruleCheck: "pass",
    requestedAt: "1d ago",
  }
];

export const monthlyReport = [
  { employee: mockEmployees[1], scheduled: 160, worked: 168, overtime: 8, due: 0, wage: 4200 },
  { employee: mockEmployees[4], scheduled: 120, worked: 110, overtime: 0, due: 10, wage: 3000 },
  { employee: mockEmployees[5], scheduled: 80, worked: 80, overtime: 0, due: 0, wage: 2000 },
  { employee: mockEmployees[8], scheduled: 160, worked: 172, overtime: 12, due: 0, wage: 4400 },
  { employee: mockEmployees[9], scheduled: 160, worked: 155, overtime: 0, due: 5, wage: 3950 },
];
