import AiChatbot from '@/components/screens-components/ai-chat/ai-chatbot';
import AppErrorBoundary from '@/components/shared/app-error-boundary';

export default function AiChatScreen() {
  return (
    <AppErrorBoundary label="AI Chat">
      <AiChatbot />
    </AppErrorBoundary>
  );
}
