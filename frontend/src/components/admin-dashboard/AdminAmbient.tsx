/** Cyber ambient grid and neon blurs behind the admin dashboard. */
export function AdminAmbient() {
  return (
    <>
      {/* Cyber ambient grids and neon blurs */}
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-[10%] left-[-15%] w-[60%] h-[60%] rounded-full bg-cyan-600/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />
    </>
  );
}
