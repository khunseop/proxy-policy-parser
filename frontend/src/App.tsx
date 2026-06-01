import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppHeader } from './components/layout/AppHeader'
import { AppLayout } from './components/layout/AppLayout'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppHeader />
      <AppLayout />
    </QueryClientProvider>
  )
}
