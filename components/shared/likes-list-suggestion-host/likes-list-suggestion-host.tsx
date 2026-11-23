
import ListSuggestionSheet from '@/components/screens-components/list-suggestion-sheet';
import { useLikesContext } from '@/contexts/likes.context';
import { useGoToTab } from '@/hooks/use-app-navigation';

/**
 * App-wide bridge between the LikesContext's `shouldSuggestList` flag
 * and the ListSuggestionSheet. Mounts once in `app/_layout.tsx` so any
 * `toggleLike()` call from anywhere can pop the sheet automatically.
 */
export default function LikesListSuggestionHost() {
  const goToTab = useGoToTab();
  const { shouldSuggestList, acknowledgeListSuggestion } = useLikesContext();

  const handleCreate = () => {
    acknowledgeListSuggestion();
    // The Lists tab lives inside the Cart stack — once the user taps
    // Create-a-list we ship them straight there. They can refine.
    goToTab('/cart');
  };

  return (
    <ListSuggestionSheet
      visible={shouldSuggestList}
      onCreateList={handleCreate}
      onSkip={acknowledgeListSuggestion}
    />
  );
}
