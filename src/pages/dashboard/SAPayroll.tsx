import HRPayroll from "./HRPayroll";

// SA sees the same payroll interface as HR
export default function SAPayroll() {
  return <HRPayroll />;
}
