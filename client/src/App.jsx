import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastContainer, useToast } from "./components/common/Toast";
import PushPrompt from "./components/common/PushPrompt";
import AppRouter from "./routes/AppRouter";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent = () => {
  const { toasts, removeToast } = useToast();
  return (
    <>
      <AppRouter />
      <div className="fixed bottom-4 right-4 z-[75] w-[min(24rem,calc(100vw-2rem))]">
        <PushPrompt />
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
