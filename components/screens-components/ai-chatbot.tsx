import {
    Car,
    EllipsisVertical,
    Gauge,
    History,
    Receipt,
    ScanSearch,
    SlidersHorizontal,
    Sparkles,
    Tag,
    Wrench
} from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import AiChatComposer from '@/components/screens-components/ai-chat-composer';
import AiChatMessageBubble from '@/components/screens-components/ai-chat-message-bubble';
import AiChatSuggestionChip from '@/components/screens-components/ai-chat-suggestion-chip';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import {
    getAiChatHistoryMock,
    sendAiChatMessageMock,
    type AiChatMessage,
    type AiChatVehicleContext,
} from '@/services/ai-chat-service';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { triggerHaptic } from '@/utils/haptics';
import { KeyboardStickyView } from "react-native-keyboard-controller";

const THINGS_I_CAN_DO = [
    { key: 'fitment', label: 'Check part fitment', Icon: Wrench },
    { key: 'orders', label: 'Track orders', Icon: Receipt },
    { key: 'compare', label: 'Compare brands', Icon: SlidersHorizontal },
] as const;

const SHOPPING_QUESTIONS = [
    { key: 'upgrade', label: 'What upgrades fit my build?', Icon: Gauge },
    { key: 'deals', label: 'Which deals match my car?', Icon: Tag },
    { key: 'identify', label: 'Help me identify this part', Icon: ScanSearch },
] as const;

export default function AiChatbot() {
    const { tokens, scheme } = useThemeContext();
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [vehicleContext, setVehicleContext] = useState<AiChatVehicleContext | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const brandText = scheme === 'dark' ? tokens.text : tokens.brand;
    const historyItems = getAiChatHistoryMock();

    function openVehicleSelector() {
        triggerHaptic('selection');
        modalService.openModal('carSelection', {
            initialMake: vehicleContext?.makeId ?? '',
            initialModel: vehicleContext?.modelId ?? '',
            initialTrim: vehicleContext?.trimId ?? '',
            onSelect: (selection: AiChatVehicleContext) => {
                setVehicleContext(selection);
                setError(null);
                triggerHaptic('success');
            },
        });
    }

    function restoreLatestHistory() {
        const latest = historyItems[0];
        if (!latest) {
            return;
        }

        triggerHaptic('selection');
        setConversationId(latest.id);
        setMessages(latest.messages);
        setVehicleContext(latest.vehicleContext ?? null);
        setError(null);
    }

    function clearChat() {
        triggerHaptic('selection');
        setConversationId(null);
        setMessages([]);
        setDraft('');
        setError(null);
    }

    async function pushMessage(text: string) {
        const trimmed = text.trim();
        if (!trimmed || isSending) return;

        triggerHaptic('selection');
        setError(null);
        setDraft('');
        setMessages((current) => [
            ...current,
            {
                id: `user-${Date.now()}`,
                role: 'user',
                caption: 'Now',
                body: trimmed,
                createdAt: new Date().toISOString(),
            },
        ]);
        setIsSending(true);

        try {
            const response = await sendAiChatMessageMock({
                conversationId,
                message: trimmed,
                vehicleContext,
            });

            setConversationId(response.conversationId);
            setMessages((current) => [...current, response.reply]);
        } catch (err) {
            triggerHaptic('error');
            setError(err instanceof Error ? err.message : 'Unable to reach chat services right now.');
            setMessages((current) => [
                ...current,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: 'assistant',
                    title: 'Matorui Assistant',
                    caption: 'Retry needed',
                    body: 'I could not reach the chat service. Please try again once the API connection is available.',
                    createdAt: new Date().toISOString(),
                },
            ]);
        } finally {
            setIsSending(false);
        }
    }

    return (
        <ScreenShell>
            <AppView flex={1} pt={6} >
                {/* Top bar */}
                <AppView
                    row
                    align="center"
                    justify="space-between"
                    px={16}
                    py={12}
                    borderBottomWidth={1}
                    borderTopWidth={1}
                    borderColor={tokens.gray400}
                >
                    <AppView row align="center" gap={10}>
                        <AppPressableView
                            center
                            rounded={36}
                            androidRipple={false}
                            pressedOpacity={0.7}
                            style={{ width: 32, height: 32 }}
                        >
                        </AppPressableView>
                        <AppView row align="center" gap={6} >
                            <Sparkles size={16} strokeWidth={2.2} color={brandText} />
                            <AppText
                                textVariant="bodySemibold"
                                family="heading"
                                weight="bold"
                                style={{ color: brandText, letterSpacing: 0.3 }}
                            >
                                Matorui Copilot
                            </AppText>
                        </AppView>
                    </AppView>

                    <AppView row align="center" gap={6}>
                        <AppPressableView
                            center
                            rounded={36}
                            androidRipple={false}
                            pressedOpacity={0.7}
                                onPress={restoreLatestHistory}
                            style={{ width: 36, height: 36 }}
                        >
                            <History size={18} strokeWidth={2.2} color={tokens.icon} />
                        </AppPressableView>
                        <AppPressableView
                            center
                            rounded={999}
                            androidRipple={false}
                            pressedOpacity={0.7}
                                onPress={clearChat}
                            style={{ width: 36, height: 36 }}
                        >
                            <EllipsisVertical size={18} strokeWidth={2.2} color={tokens.icon} />
                        </AppPressableView>
                    </AppView>
                </AppView>

                {/* View chat history pill */}
                <AppView align="center" mt={8} pb={12}>
                    <AppPressableView
                        rounded={999}
                        px={14}
                        py={8}
                        androidRipple={false}
                        pressedOpacity={0.8}
                        onPress={restoreLatestHistory}
                        style={{
                            borderWidth: 1,
                            borderColor: tokens.border,
                            backgroundColor: tokens.card,
                        }}
                    >
                        <AppText textVariant="bodySm" weight="semibold" style={{ color: brandText }}>
                            View chat history
                        </AppText>
                    </AppPressableView>
                </AppView>

                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {messages.length === 0 ? (
                        <AppView gap={26}>
                            {/* Greeting */}
                            <AppView gap={14}>
                                <AppView gap={4}>
                                    <AppText textVariant="h4" family="heading" weight="bold" colorName="text">
                                        Hello! I&apos;m your Matorui copilot.
                                    </AppText>
                                    <AppText textVariant="bodySm" colorName="text" style={{ lineHeight: 22 }}>
                                        Tell me about your vehicle so I can give personalized parts and fitment help.
                                    </AppText>
                                    {vehicleContext?.selectedCarName ? (
                                        <AppText textVariant="bodyXs" style={{ color: brandText }}>
                                            Vehicle selected: {vehicleContext.selectedCarName}
                                        </AppText>
                                    ) : null}
                                </AppView>

                                <AppView
                                    style={{
                                        height: 1,
                                        backgroundColor: tokens.divider,
                                        opacity: 0.9,
                                    }}
                                />

                                <AppPressableView
                                    row
                                    align="center"
                                    gap={8}
                                    rounded={999}
                                    px={16}
                                    py={12}
                                    androidRipple={false}
                                    pressedOpacity={0.85}
                                    onPress={openVehicleSelector}
                                    style={{
                                        alignSelf: 'flex-start',
                                        backgroundColor: tokens.brand,
                                    }}
                                >
                                    <AppView row align="center" gap={8}>
                                        <Car size={16} strokeWidth={2.2} color={tokens.onBrand} />
                                        <AppText
                                            textVariant="bodySm"
                                            weight="semibold"
                                            style={{ color: tokens.onBrand }}
                                        >
                                            {vehicleContext?.selectedCarName || 'Select your vehicle'}
                                        </AppText>
                                    </AppView>
                                </AppPressableView>
                            </AppView>

                            {/* Things I can do */}
                            <AppView gap={12}>
                                <AppText textVariant="bodySemibold" family="heading" weight="bold" colorName="text">
                                    Things I can do
                                </AppText>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 10, paddingRight: 12 }}
                                >
                                    {THINGS_I_CAN_DO.map((item) => (
                                        <AiChatSuggestionChip
                                            key={item.key}
                                            label={item.label}
                                            Icon={item.Icon}
                                            onPress={() => {
                                                void pushMessage(item.label);
                                            }}
                                        />
                                    ))}
                                </ScrollView>
                            </AppView>

                            {/* Questions while you shop */}
                            <AppView gap={12}>
                                <AppText textVariant="bodySemibold" family="heading" weight="bold" colorName="text">
                                    Questions while you shop? Ask away!
                                </AppText>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 10, paddingRight: 12 }}
                                >
                                    {SHOPPING_QUESTIONS.map((item) => (
                                        <AiChatSuggestionChip
                                            key={item.key}
                                            label={item.label}
                                            Icon={item.Icon}
                                            onPress={() => {
                                                void pushMessage(item.label);
                                            }}
                                        />
                                    ))}
                                </ScrollView>
                            </AppView>

                            {/* AI disclaimer */}
                            <AppView gap={6}>
                                <AppText textVariant="bodyXs" colorName="gray400" style={{ lineHeight: 18 }}>
                                    My answers are powered by AI, so I may not always get things right.{' '}
                                    <AppText textVariant="bodyXs" weight="semibold" style={{ color: brandText }}>
                                        Learn more
                                    </AppText>
                                </AppText>
                                {error ? (
                                    <AppText textVariant="bodyXs" colorName={'error' as any}>
                                        {error}
                                    </AppText>
                                ) : null}
                            </AppView>
                        </AppView>
                    ) : (
                        <AppView gap={14}>
                            <AppView
                                align="center"
                                rounded={999}
                                px={12}
                                py={6}
                                style={{
                                    borderWidth: 1,
                                    borderColor: tokens.border,
                                    backgroundColor: tokens.card,
                                    alignSelf: 'center',
                                }}
                            >
                                <AppText textVariant="caption" colorName="gray400">
                                    Today
                                </AppText>
                            </AppView>

                            <AppView gap={12}>
                                {messages.map((message) => (
                                    <AiChatMessageBubble
                                        key={message.id}
                                        role={message.role}
                                        title={message.title}
                                        body={message.body}
                                        caption={message.caption}
                                    />
                                ))}
                                {isSending ? (
                                    <AiChatMessageBubble
                                        role="assistant"
                                        title="Matorui Assistant"
                                        body="Checking fitment logic and account-ready actions..."
                                        caption="Sending"
                                    />
                                ) : null}
                            </AppView>
                            {error ? (
                                <AppText textVariant="bodyXs" colorName={'error' as any}>
                                    {error}
                                </AppText>
                            ) : null}
                        </AppView>
                    )}
                </ScrollView>

                {/* Composer pinned bottom (above tab bar) */}
                <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
                    <AppView  pt={4} pb={0} colorName="background">
                        <AiChatComposer
                            value={draft}
                            onChangeText={setDraft}
                            onSend={() => {
                                void pushMessage(draft);
                            }}
                            onLeftActionPress={openVehicleSelector}
                            disabled={isSending}
                        />
                    </AppView>
                </KeyboardStickyView>
            </AppView>
        </ScreenShell>
    );
}

