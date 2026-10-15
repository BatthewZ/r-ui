// Deliberately bad: every line below must be reported by verify:no-raw-tailwind.
// p-4 in a comment must NOT be reported (comments are not class lists).
const hoisted = "inline-flex px-3 py-1.5";
export function Bad() {
  return (
    <div className="p-4 gap-2 h-8 w-9 min-w-45 -mt-4 md:hover:mt-4">
      <span className="text-sm text-xs">a</span>
      <span className="bg-blue-500 text-white ring-black/50">b</span>
      <span className="rounded shadow rounded-t">c</span>
      <span className="p-[12px] bg-[#fff] w-[3rem] text-[oklch(0.5_0.1_200)]">d</span>
      <span className={hoisted} style={{ width: "12px", color: "#ff0000" }}>e</span>
      <span className="sticky z-10">f</span>
    </div>
  );
}
