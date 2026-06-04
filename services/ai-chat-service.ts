export type AiChatRole = 'assistant' | 'user';

export type AiChatVehicleContext = {
  makeId: string;
  modelId: string;
  trimId: string;
  selectedCarName: string;
};

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  body: string;
  caption?: string;
  title?: string;
  createdAt: string;
};

export type AiChatConversationSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  vehicleContext?: AiChatVehicleContext | null;
  messages: AiChatMessage[];
};

export type AiChatSendMessageRequest = {
  conversationId?: string | null;
  message: string;
  vehicleContext?: AiChatVehicleContext | null;
};

export type AiChatSendMessageResponse = {
  conversationId: string;
  reply: AiChatMessage;
  suggestions: string[];
};

export const AI_CHAT_API_BASE_PATH = '/api/v1/chatbot';

const MOCK_HISTORY: AiChatConversationSummary[] = [
  {
    id: 'chat-history-1',
    title: 'BMW F30 brake fitment',
    preview: 'Confirmed 340mm front rotor options for your F30 build.',
    updatedAt: '2026-06-03T20:12:00Z',
    vehicleContext: {
      makeId: 'bmw',
      modelId: '3-series',
      trimId: 'f30-340i',
      selectedCarName: 'BMW 340i F30',
    },
    messages: [
      {
        id: 'history-user-1',
        role: 'user',
        body: 'Will this brake kit fit my BMW 340i F30?',
        caption: 'Yesterday',
        createdAt: '2026-06-03T20:10:00Z',
      },
      {
        id: 'history-assistant-1',
        role: 'assistant',
        title: 'Matorui Assistant',
        body: 'For your BMW 340i F30, start with rotor diameter, caliper clearance, and wheel size. A 340mm front kit is the safest baseline unless your car already has the M Sport package.',
        caption: 'Yesterday',
        createdAt: '2026-06-03T20:10:06Z',
      },
    ],
  },
];

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildVehiclePrefix(vehicleContext?: AiChatVehicleContext | null) {
  if (!vehicleContext?.selectedCarName) {
    return '';
  }

  return `For your ${vehicleContext.selectedCarName}, `;
}

export function getAiChatHistoryMock() {
  return MOCK_HISTORY;
}

export async function sendAiChatMessageMock({
  conversationId,
  message,
  vehicleContext,
}: AiChatSendMessageRequest): Promise<AiChatSendMessageResponse> {
  const normalized = message.toLowerCase();
  const vehiclePrefix = buildVehiclePrefix(vehicleContext);

  let body = `${vehiclePrefix}I can help with fitment, order tracking, returns, and product comparisons once the backend tools are connected.`;

  if (normalized.includes('order') || normalized.includes('track')) {
    body = `${vehiclePrefix}I am ready for order APIs. Once connected, I should return shipment state, payment status, tracking milestones, and support escalation options in one response.`;
  } else if (
    normalized.includes('fit') ||
    normalized.includes('upgrade') ||
    normalized.includes('build') ||
    normalized.includes('part')
  ) {
    body = `${vehiclePrefix}share the exact year, make, model, trim, and engine if you have not already. The API response should then confirm fitment, highlight edge cases, and return compatible alternatives.`;
  } else if (normalized.includes('deal') || normalized.includes('discount')) {
    body = `${vehiclePrefix}the deals response should prioritize promotions that match your saved vehicle, active cart items, and viewed categories instead of generic discounts.`;
  } else if (normalized.includes('return') || normalized.includes('warranty')) {
    body = `${vehiclePrefix}returns and warranty support should come back with policy guidance, required evidence, and the correct next action for the signed-in user.`;
  }

  return {
    conversationId: conversationId ?? 'chat-active',
    suggestions: [
      'Check part fitment',
      'Track orders',
      'What upgrades fit my build?',
    ],
    reply: {
      id: createMessageId('assistant'),
      role: 'assistant',
      title: 'Matorui Assistant',
      body,
      caption: 'Now',
      createdAt: new Date().toISOString(),
    },
  };
}