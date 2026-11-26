import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { DashProvider } from "@/components/dash-provider";
import { CallbackPage } from "@/pages/callback-page";
import { DashboardPage } from "@/pages/dashboard-page";

export function App() {
  return (
    <DashProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DashProvider>
  );
}
