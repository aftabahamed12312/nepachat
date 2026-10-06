import { CreateUserData, UpdateUserData, DeleteUserData, GetUserData, ListUsersData, CreateChatData, UpdateChatData, UpdateChatVariables, DeleteChatData, DeleteChatVariables, GetChatData, GetChatVariables, ListChatsData, CreateMembershipData, CreateMembershipVariables, UpdateMembershipData, UpdateMembershipVariables, DeleteMembershipData, DeleteMembershipVariables, GetMembershipData, GetMembershipVariables, ListMyMembershipsData, SendMessageData, SendMessageVariables, UpdateMessageData, UpdateMessageVariables, DeleteMessageData, DeleteMessageVariables, GetMessageData, GetMessageVariables, ListMessagesInChatData, ListMessagesInChatVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, void>): UseDataConnectMutationResult<CreateUserData, undefined>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, void>): UseDataConnectMutationResult<CreateUserData, undefined>;

export function useUpdateUser(options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, void>): UseDataConnectMutationResult<UpdateUserData, undefined>;
export function useUpdateUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, void>): UseDataConnectMutationResult<UpdateUserData, undefined>;

export function useDeleteUser(options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;
export function useDeleteUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;

export function useGetUser(options?: useDataConnectQueryOptions<GetUserData>): UseDataConnectQueryResult<GetUserData, undefined>;
export function useGetUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetUserData>): UseDataConnectQueryResult<GetUserData, undefined>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useCreateChat(options?: useDataConnectMutationOptions<CreateChatData, FirebaseError, void>): UseDataConnectMutationResult<CreateChatData, undefined>;
export function useCreateChat(dc: DataConnect, options?: useDataConnectMutationOptions<CreateChatData, FirebaseError, void>): UseDataConnectMutationResult<CreateChatData, undefined>;

export function useUpdateChat(options?: useDataConnectMutationOptions<UpdateChatData, FirebaseError, UpdateChatVariables>): UseDataConnectMutationResult<UpdateChatData, UpdateChatVariables>;
export function useUpdateChat(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateChatData, FirebaseError, UpdateChatVariables>): UseDataConnectMutationResult<UpdateChatData, UpdateChatVariables>;

export function useDeleteChat(options?: useDataConnectMutationOptions<DeleteChatData, FirebaseError, DeleteChatVariables>): UseDataConnectMutationResult<DeleteChatData, DeleteChatVariables>;
export function useDeleteChat(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteChatData, FirebaseError, DeleteChatVariables>): UseDataConnectMutationResult<DeleteChatData, DeleteChatVariables>;

export function useGetChat(vars: GetChatVariables, options?: useDataConnectQueryOptions<GetChatData>): UseDataConnectQueryResult<GetChatData, GetChatVariables>;
export function useGetChat(dc: DataConnect, vars: GetChatVariables, options?: useDataConnectQueryOptions<GetChatData>): UseDataConnectQueryResult<GetChatData, GetChatVariables>;

export function useListChats(options?: useDataConnectQueryOptions<ListChatsData>): UseDataConnectQueryResult<ListChatsData, undefined>;
export function useListChats(dc: DataConnect, options?: useDataConnectQueryOptions<ListChatsData>): UseDataConnectQueryResult<ListChatsData, undefined>;

export function useCreateMembership(options?: useDataConnectMutationOptions<CreateMembershipData, FirebaseError, CreateMembershipVariables>): UseDataConnectMutationResult<CreateMembershipData, CreateMembershipVariables>;
export function useCreateMembership(dc: DataConnect, options?: useDataConnectMutationOptions<CreateMembershipData, FirebaseError, CreateMembershipVariables>): UseDataConnectMutationResult<CreateMembershipData, CreateMembershipVariables>;

export function useUpdateMembership(options?: useDataConnectMutationOptions<UpdateMembershipData, FirebaseError, UpdateMembershipVariables>): UseDataConnectMutationResult<UpdateMembershipData, UpdateMembershipVariables>;
export function useUpdateMembership(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateMembershipData, FirebaseError, UpdateMembershipVariables>): UseDataConnectMutationResult<UpdateMembershipData, UpdateMembershipVariables>;

export function useDeleteMembership(options?: useDataConnectMutationOptions<DeleteMembershipData, FirebaseError, DeleteMembershipVariables>): UseDataConnectMutationResult<DeleteMembershipData, DeleteMembershipVariables>;
export function useDeleteMembership(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteMembershipData, FirebaseError, DeleteMembershipVariables>): UseDataConnectMutationResult<DeleteMembershipData, DeleteMembershipVariables>;

export function useGetMembership(vars: GetMembershipVariables, options?: useDataConnectQueryOptions<GetMembershipData>): UseDataConnectQueryResult<GetMembershipData, GetMembershipVariables>;
export function useGetMembership(dc: DataConnect, vars: GetMembershipVariables, options?: useDataConnectQueryOptions<GetMembershipData>): UseDataConnectQueryResult<GetMembershipData, GetMembershipVariables>;

export function useListMyMemberships(options?: useDataConnectQueryOptions<ListMyMembershipsData>): UseDataConnectQueryResult<ListMyMembershipsData, undefined>;
export function useListMyMemberships(dc: DataConnect, options?: useDataConnectQueryOptions<ListMyMembershipsData>): UseDataConnectQueryResult<ListMyMembershipsData, undefined>;

export function useSendMessage(options?: useDataConnectMutationOptions<SendMessageData, FirebaseError, SendMessageVariables>): UseDataConnectMutationResult<SendMessageData, SendMessageVariables>;
export function useSendMessage(dc: DataConnect, options?: useDataConnectMutationOptions<SendMessageData, FirebaseError, SendMessageVariables>): UseDataConnectMutationResult<SendMessageData, SendMessageVariables>;

export function useUpdateMessage(options?: useDataConnectMutationOptions<UpdateMessageData, FirebaseError, UpdateMessageVariables>): UseDataConnectMutationResult<UpdateMessageData, UpdateMessageVariables>;
export function useUpdateMessage(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateMessageData, FirebaseError, UpdateMessageVariables>): UseDataConnectMutationResult<UpdateMessageData, UpdateMessageVariables>;

export function useDeleteMessage(options?: useDataConnectMutationOptions<DeleteMessageData, FirebaseError, DeleteMessageVariables>): UseDataConnectMutationResult<DeleteMessageData, DeleteMessageVariables>;
export function useDeleteMessage(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteMessageData, FirebaseError, DeleteMessageVariables>): UseDataConnectMutationResult<DeleteMessageData, DeleteMessageVariables>;

export function useGetMessage(vars: GetMessageVariables, options?: useDataConnectQueryOptions<GetMessageData>): UseDataConnectQueryResult<GetMessageData, GetMessageVariables>;
export function useGetMessage(dc: DataConnect, vars: GetMessageVariables, options?: useDataConnectQueryOptions<GetMessageData>): UseDataConnectQueryResult<GetMessageData, GetMessageVariables>;

export function useListMessagesInChat(vars: ListMessagesInChatVariables, options?: useDataConnectQueryOptions<ListMessagesInChatData>): UseDataConnectQueryResult<ListMessagesInChatData, ListMessagesInChatVariables>;
export function useListMessagesInChat(dc: DataConnect, vars: ListMessagesInChatVariables, options?: useDataConnectQueryOptions<ListMessagesInChatData>): UseDataConnectQueryResult<ListMessagesInChatData, ListMessagesInChatVariables>;
