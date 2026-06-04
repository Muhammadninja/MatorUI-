export type Address = {
  id: string;
  label: string;
  name: string;
  line1: string;
  line2: string;
  isDefault: boolean;
};

export type AddressDraft = {
  label: string;
  name: string;
  line1: string;
  line2: string;
};

export const INITIAL_ADDRESSES: Address[] = [
  {
    id: 'addr1',
    label: 'Home',
    name: 'Muhammad Abdullaev',
    line1: '142 Elm Street, Apt 3B',
    line2: 'San Francisco, CA 94102, US',
    isDefault: true,
  },
  {
    id: 'addr2',
    label: 'Work',
    name: 'Muhammad Abdullaev',
    line1: '1 Market Street, Suite 800',
    line2: 'San Francisco, CA 94105, US',
    isDefault: false,
  },
  {
    id: 'addr3',
    label: 'Garage',
    name: 'Muhammad Abdullaev',
    line1: '88 Industrial Blvd',
    line2: 'Oakland, CA 94601, US',
    isDefault: false,
  },
];

export const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  label: '',
  name: '',
  line1: '',
  line2: '',
};

export function isAddressDraftValid(draft: AddressDraft) {
  return !!draft.label.trim() && !!draft.name.trim() && !!draft.line1.trim() && !!draft.line2.trim();
}

export function buildAddress(draft: AddressDraft, id: string, isDefault: boolean): Address {
  return {
    id,
    label: draft.label.trim(),
    name: draft.name.trim(),
    line1: draft.line1.trim(),
    line2: draft.line2.trim(),
    isDefault,
  };
}
