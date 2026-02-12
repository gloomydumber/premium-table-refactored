import { useMemo } from "react";
import { WidthProvider, Responsive } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "./grid-overrides.css";
import { PremiumTable } from "./components/PremiumTable";

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLS = 12;

function App() {
  const layouts = useMemo(
    () => ({
      lg: [{ i: "table", x: 0, y: 0, w: COLS, h: 1, static: true }],
    }),
    []
  );

  return (
    <ResponsiveGridLayout
      layouts={layouts}
      breakpoints={{ lg: 0 }}
      cols={{ lg: COLS }}
      margin={[0, 0]}
      containerPadding={[0, 0]}
      isDraggable={false}
      isResizable={false}
      autoSize={false}
      style={{ height: "100vh" }}
    >
      <div key="table" style={{ overflow: "hidden", height: "100%" }}>
        <PremiumTable height="100%" />
      </div>
    </ResponsiveGridLayout>
  );
}

export default App;
