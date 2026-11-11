import React from 'react';
import { Linking } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { parseMarkdown, type MarkdownBlock, type MarkdownInline } from '@/utils/markdown';

export type AppMarkdownProps = {
  /** Raw Markdown from the backend. Treated as untrusted. */
  content: string;
};

/** Heading sizes by level — legal docs rarely go past h3, but all six map. */
const HEADING_SIZE: Record<number, number> = { 1: 19, 2: 17, 3: 15.5, 4: 14.5, 5: 14, 6: 13.5 };

function InlineSpans({ spans, color }: { spans: MarkdownInline[]; color: string }) {
  return (
    <>
      {spans.map((span, i) => {
        const weight = span.bold ? 'bold' : undefined;
        if (span.kind === 'link') {
          return (
            <AppText
              key={i}
              family="default"
              weight={weight}
              italic={span.italic}
              underline
              style={{ color }}
              // `href` is scheme-checked by the parser; unsafe targets never
              // reach here as links (they degrade to plain text).
              onPress={() => void Linking.openURL(span.href)}
            >
              {span.text}
            </AppText>
          );
        }
        return (
          <AppText key={i} family="default" weight={weight} italic={span.italic} style={{ color }}>
            {span.text}
          </AppText>
        );
      })}
    </>
  );
}

/**
 * Renders backend Markdown using React Native text primitives only.
 *
 * Safety: there is no HTML parsing, no `dangerouslySetInnerHTML` and no
 * WebView anywhere in this path. Any markup embedded in the document is shown
 * as literal characters, and link targets are restricted to http(s)/mailto by
 * `utils/markdown`. See that module for the full threat model.
 */
export function AppMarkdown({ content }: AppMarkdownProps) {
  const { tokens } = useThemeContext();
  const blocks = React.useMemo<MarkdownBlock[]>(() => parseMarkdown(content), [content]);

  return (
    <AppView gap={12}>
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <AppText
              key={i}
              family="heading"
              weight="bold"
              style={{ fontSize: HEADING_SIZE[block.level] ?? 14, color: tokens.text }}
            >
              <InlineSpans spans={block.spans} color={tokens.text} />
            </AppText>
          );
        }

        if (block.kind === 'listItem') {
          return (
            <AppView key={i} row gap={8} style={{ paddingLeft: 4 }}>
              <AppText family="default" style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted }}>
                {block.marker}
              </AppText>
              <AppText
                family="default"
                style={{ flex: 1, fontSize: 14, lineHeight: 20, color: tokens.textMuted }}
              >
                <InlineSpans spans={block.spans} color={tokens.textMuted} />
              </AppText>
            </AppView>
          );
        }

        return (
          <AppText key={i} family="default" style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted }}>
            <InlineSpans spans={block.spans} color={tokens.textMuted} />
          </AppText>
        );
      })}
    </AppView>
  );
}

export default AppMarkdown;
