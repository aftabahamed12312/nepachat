import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Chat_Key {
  id: UUIDString;
  __typename?: 'Chat_Key';
}

export interface CreateChatData {
  chat_insert: Chat_Key;
}

export interface CreateMembershipData {
  membership_insert: Membership_Key;
}

export interface CreateMembershipVariables {
  chatId: UUIDString;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface DeleteChatData {
  chat_delete?: Chat_Key | null;
}

export interface DeleteChatVariables {
  id: UUIDString;
}

export interface DeleteMembershipData {
  membership_delete?: Membership_Key | null;
}

export interface DeleteMembershipVariables {
  id: UUIDString;
}

export interface DeleteMessageData {
  message_delete?: Message_Key | null;
}

export interface DeleteMessageVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface GetChatData {
  chat?: {
    name?: string | null;
    type: string;
  };
}

export interface GetChatVariables {
  id: UUIDString;
}

export interface GetMembershipData {
  membership?: {
    joinedAt: TimestampString;
    chat: {
      name?: string | null;
    };
  };
}

export interface GetMembershipVariables {
  id: UUIDString;
}

export interface GetMessageData {
  message?: {
    content: string;
    createdAt: TimestampString;
  };
}

export interface GetMessageVariables {
  id: UUIDString;
}

export interface GetUserData {
  user?: {
    displayName: string;
    phoneNumber: string;
  };
}

export interface ListChatsData {
  chats: ({
    name?: string | null;
    type: string;
  })[];
}

export interface ListMessagesInChatData {
  messages: ({
    content: string;
    sender: {
      displayName: string;
    };
  })[];
}

export interface ListMessagesInChatVariables {
  chatId: UUIDString;
}

export interface ListMyMembershipsData {
  memberships: ({
    chat: {
      name?: string | null;
    };
  })[];
}

export interface ListUsersData {
  users: ({
    displayName: string;
  })[];
}

export interface Membership_Key {
  id: UUIDString;
  __typename?: 'Membership_Key';
}

export interface Message_Key {
  id: UUIDString;
  __typename?: 'Message_Key';
}

export interface SendMessageData {
  message_insert: Message_Key;
}

export interface SendMessageVariables {
  chatId: UUIDString;
  content: string;
}

export interface UpdateChatData {
  chat_update?: Chat_Key | null;
}

export interface UpdateChatVariables {
  id: UUIDString;
}

export interface UpdateMembershipData {
  membership_update?: Membership_Key | null;
}

export interface UpdateMembershipVariables {
  id: UUIDString;
}

export interface UpdateMessageData {
  message_update?: Message_Key | null;
}

export interface UpdateMessageVariables {
  id: UUIDString;
  status: string;
}

export interface UpdateUserData {
  user_update?: User_Key | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateUserData, undefined>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(): MutationPromise<CreateUserData, undefined>;
export function createUser(dc: DataConnect): MutationPromise<CreateUserData, undefined>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<UpdateUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<UpdateUserData, undefined>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(): MutationPromise<UpdateUserData, undefined>;
export function updateUser(dc: DataConnect): MutationPromise<UpdateUserData, undefined>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(): MutationPromise<DeleteUserData, undefined>;
export function deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface GetUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetUserData, undefined>;
  operationName: string;
}
export const getUserRef: GetUserRef;

export function getUser(options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;
export function getUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface CreateChatRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateChatData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateChatData, undefined>;
  operationName: string;
}
export const createChatRef: CreateChatRef;

export function createChat(): MutationPromise<CreateChatData, undefined>;
export function createChat(dc: DataConnect): MutationPromise<CreateChatData, undefined>;

interface UpdateChatRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateChatVariables): MutationRef<UpdateChatData, UpdateChatVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateChatVariables): MutationRef<UpdateChatData, UpdateChatVariables>;
  operationName: string;
}
export const updateChatRef: UpdateChatRef;

export function updateChat(vars: UpdateChatVariables): MutationPromise<UpdateChatData, UpdateChatVariables>;
export function updateChat(dc: DataConnect, vars: UpdateChatVariables): MutationPromise<UpdateChatData, UpdateChatVariables>;

interface DeleteChatRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteChatVariables): MutationRef<DeleteChatData, DeleteChatVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteChatVariables): MutationRef<DeleteChatData, DeleteChatVariables>;
  operationName: string;
}
export const deleteChatRef: DeleteChatRef;

export function deleteChat(vars: DeleteChatVariables): MutationPromise<DeleteChatData, DeleteChatVariables>;
export function deleteChat(dc: DataConnect, vars: DeleteChatVariables): MutationPromise<DeleteChatData, DeleteChatVariables>;

interface GetChatRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetChatVariables): QueryRef<GetChatData, GetChatVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetChatVariables): QueryRef<GetChatData, GetChatVariables>;
  operationName: string;
}
export const getChatRef: GetChatRef;

export function getChat(vars: GetChatVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatData, GetChatVariables>;
export function getChat(dc: DataConnect, vars: GetChatVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatData, GetChatVariables>;

interface ListChatsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListChatsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListChatsData, undefined>;
  operationName: string;
}
export const listChatsRef: ListChatsRef;

export function listChats(options?: ExecuteQueryOptions): QueryPromise<ListChatsData, undefined>;
export function listChats(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListChatsData, undefined>;

interface CreateMembershipRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateMembershipVariables): MutationRef<CreateMembershipData, CreateMembershipVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateMembershipVariables): MutationRef<CreateMembershipData, CreateMembershipVariables>;
  operationName: string;
}
export const createMembershipRef: CreateMembershipRef;

export function createMembership(vars: CreateMembershipVariables): MutationPromise<CreateMembershipData, CreateMembershipVariables>;
export function createMembership(dc: DataConnect, vars: CreateMembershipVariables): MutationPromise<CreateMembershipData, CreateMembershipVariables>;

interface UpdateMembershipRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMembershipVariables): MutationRef<UpdateMembershipData, UpdateMembershipVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMembershipVariables): MutationRef<UpdateMembershipData, UpdateMembershipVariables>;
  operationName: string;
}
export const updateMembershipRef: UpdateMembershipRef;

export function updateMembership(vars: UpdateMembershipVariables): MutationPromise<UpdateMembershipData, UpdateMembershipVariables>;
export function updateMembership(dc: DataConnect, vars: UpdateMembershipVariables): MutationPromise<UpdateMembershipData, UpdateMembershipVariables>;

interface DeleteMembershipRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteMembershipVariables): MutationRef<DeleteMembershipData, DeleteMembershipVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteMembershipVariables): MutationRef<DeleteMembershipData, DeleteMembershipVariables>;
  operationName: string;
}
export const deleteMembershipRef: DeleteMembershipRef;

export function deleteMembership(vars: DeleteMembershipVariables): MutationPromise<DeleteMembershipData, DeleteMembershipVariables>;
export function deleteMembership(dc: DataConnect, vars: DeleteMembershipVariables): MutationPromise<DeleteMembershipData, DeleteMembershipVariables>;

interface GetMembershipRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMembershipVariables): QueryRef<GetMembershipData, GetMembershipVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMembershipVariables): QueryRef<GetMembershipData, GetMembershipVariables>;
  operationName: string;
}
export const getMembershipRef: GetMembershipRef;

export function getMembership(vars: GetMembershipVariables, options?: ExecuteQueryOptions): QueryPromise<GetMembershipData, GetMembershipVariables>;
export function getMembership(dc: DataConnect, vars: GetMembershipVariables, options?: ExecuteQueryOptions): QueryPromise<GetMembershipData, GetMembershipVariables>;

interface ListMyMembershipsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyMembershipsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyMembershipsData, undefined>;
  operationName: string;
}
export const listMyMembershipsRef: ListMyMembershipsRef;

export function listMyMemberships(options?: ExecuteQueryOptions): QueryPromise<ListMyMembershipsData, undefined>;
export function listMyMemberships(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyMembershipsData, undefined>;

interface SendMessageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
  operationName: string;
}
export const sendMessageRef: SendMessageRef;

export function sendMessage(vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;
export function sendMessage(dc: DataConnect, vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface UpdateMessageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMessageVariables): MutationRef<UpdateMessageData, UpdateMessageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMessageVariables): MutationRef<UpdateMessageData, UpdateMessageVariables>;
  operationName: string;
}
export const updateMessageRef: UpdateMessageRef;

export function updateMessage(vars: UpdateMessageVariables): MutationPromise<UpdateMessageData, UpdateMessageVariables>;
export function updateMessage(dc: DataConnect, vars: UpdateMessageVariables): MutationPromise<UpdateMessageData, UpdateMessageVariables>;

interface DeleteMessageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteMessageVariables): MutationRef<DeleteMessageData, DeleteMessageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteMessageVariables): MutationRef<DeleteMessageData, DeleteMessageVariables>;
  operationName: string;
}
export const deleteMessageRef: DeleteMessageRef;

export function deleteMessage(vars: DeleteMessageVariables): MutationPromise<DeleteMessageData, DeleteMessageVariables>;
export function deleteMessage(dc: DataConnect, vars: DeleteMessageVariables): MutationPromise<DeleteMessageData, DeleteMessageVariables>;

interface GetMessageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMessageVariables): QueryRef<GetMessageData, GetMessageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMessageVariables): QueryRef<GetMessageData, GetMessageVariables>;
  operationName: string;
}
export const getMessageRef: GetMessageRef;

export function getMessage(vars: GetMessageVariables, options?: ExecuteQueryOptions): QueryPromise<GetMessageData, GetMessageVariables>;
export function getMessage(dc: DataConnect, vars: GetMessageVariables, options?: ExecuteQueryOptions): QueryPromise<GetMessageData, GetMessageVariables>;

interface ListMessagesInChatRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMessagesInChatVariables): QueryRef<ListMessagesInChatData, ListMessagesInChatVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListMessagesInChatVariables): QueryRef<ListMessagesInChatData, ListMessagesInChatVariables>;
  operationName: string;
}
export const listMessagesInChatRef: ListMessagesInChatRef;

export function listMessagesInChat(vars: ListMessagesInChatVariables, options?: ExecuteQueryOptions): QueryPromise<ListMessagesInChatData, ListMessagesInChatVariables>;
export function listMessagesInChat(dc: DataConnect, vars: ListMessagesInChatVariables, options?: ExecuteQueryOptions): QueryPromise<ListMessagesInChatData, ListMessagesInChatVariables>;

