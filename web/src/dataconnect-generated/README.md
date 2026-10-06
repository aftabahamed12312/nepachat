# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetUser*](#getuser)
  - [*ListUsers*](#listusers)
  - [*GetChat*](#getchat)
  - [*ListChats*](#listchats)
  - [*GetMembership*](#getmembership)
  - [*ListMyMemberships*](#listmymemberships)
  - [*GetMessage*](#getmessage)
  - [*ListMessagesInChat*](#listmessagesinchat)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*UpdateUser*](#updateuser)
  - [*DeleteUser*](#deleteuser)
  - [*CreateChat*](#createchat)
  - [*UpdateChat*](#updatechat)
  - [*DeleteChat*](#deletechat)
  - [*CreateMembership*](#createmembership)
  - [*UpdateMembership*](#updatemembership)
  - [*DeleteMembership*](#deletemembership)
  - [*SendMessage*](#sendmessage)
  - [*UpdateMessage*](#updatemessage)
  - [*DeleteMessage*](#deletemessage)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetUser
You can execute the `GetUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUser(options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;

interface GetUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserData, undefined>;
}
export const getUserRef: GetUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;

interface GetUserRef {
  ...
  (dc: DataConnect): QueryRef<GetUserData, undefined>;
}
export const getUserRef: GetUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserRef:
```typescript
const name = getUserRef.operationName;
console.log(name);
```

### Variables
The `GetUser` query has no variables.
### Return Type
Recall that executing the `GetUser` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserData {
  user?: {
    displayName: string;
    phoneNumber: string;
  };
}
```
### Using `GetUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUser } from '@dataconnect/generated';


// Call the `getUser()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUser(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getUser().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUser`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserRef } from '@dataconnect/generated';


// Call the `getUserRef()` function to get a reference to the query.
const ref = getUserRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUsersData {
  users: ({
    displayName: string;
  })[];
}
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@dataconnect/generated';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@dataconnect/generated';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## GetChat
You can execute the `GetChat` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getChat(vars: GetChatVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatData, GetChatVariables>;

interface GetChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetChatVariables): QueryRef<GetChatData, GetChatVariables>;
}
export const getChatRef: GetChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getChat(dc: DataConnect, vars: GetChatVariables, options?: ExecuteQueryOptions): QueryPromise<GetChatData, GetChatVariables>;

interface GetChatRef {
  ...
  (dc: DataConnect, vars: GetChatVariables): QueryRef<GetChatData, GetChatVariables>;
}
export const getChatRef: GetChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getChatRef:
```typescript
const name = getChatRef.operationName;
console.log(name);
```

### Variables
The `GetChat` query requires an argument of type `GetChatVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetChatVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetChat` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetChatData {
  chat?: {
    name?: string | null;
    type: string;
  };
}
```
### Using `GetChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getChat, GetChatVariables } from '@dataconnect/generated';

// The `GetChat` query requires an argument of type `GetChatVariables`:
const getChatVars: GetChatVariables = {
  id: ..., 
};

// Call the `getChat()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getChat(getChatVars);
// Variables can be defined inline as well.
const { data } = await getChat({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getChat(dataConnect, getChatVars);

console.log(data.chat);

// Or, you can use the `Promise` API.
getChat(getChatVars).then((response) => {
  const data = response.data;
  console.log(data.chat);
});
```

### Using `GetChat`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getChatRef, GetChatVariables } from '@dataconnect/generated';

// The `GetChat` query requires an argument of type `GetChatVariables`:
const getChatVars: GetChatVariables = {
  id: ..., 
};

// Call the `getChatRef()` function to get a reference to the query.
const ref = getChatRef(getChatVars);
// Variables can be defined inline as well.
const ref = getChatRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getChatRef(dataConnect, getChatVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.chat);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.chat);
});
```

## ListChats
You can execute the `ListChats` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listChats(options?: ExecuteQueryOptions): QueryPromise<ListChatsData, undefined>;

interface ListChatsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListChatsData, undefined>;
}
export const listChatsRef: ListChatsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listChats(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListChatsData, undefined>;

interface ListChatsRef {
  ...
  (dc: DataConnect): QueryRef<ListChatsData, undefined>;
}
export const listChatsRef: ListChatsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listChatsRef:
```typescript
const name = listChatsRef.operationName;
console.log(name);
```

### Variables
The `ListChats` query has no variables.
### Return Type
Recall that executing the `ListChats` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListChatsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListChatsData {
  chats: ({
    name?: string | null;
    type: string;
  })[];
}
```
### Using `ListChats`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listChats } from '@dataconnect/generated';


// Call the `listChats()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listChats();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listChats(dataConnect);

console.log(data.chats);

// Or, you can use the `Promise` API.
listChats().then((response) => {
  const data = response.data;
  console.log(data.chats);
});
```

### Using `ListChats`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listChatsRef } from '@dataconnect/generated';


// Call the `listChatsRef()` function to get a reference to the query.
const ref = listChatsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listChatsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.chats);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.chats);
});
```

## GetMembership
You can execute the `GetMembership` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMembership(vars: GetMembershipVariables, options?: ExecuteQueryOptions): QueryPromise<GetMembershipData, GetMembershipVariables>;

interface GetMembershipRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMembershipVariables): QueryRef<GetMembershipData, GetMembershipVariables>;
}
export const getMembershipRef: GetMembershipRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMembership(dc: DataConnect, vars: GetMembershipVariables, options?: ExecuteQueryOptions): QueryPromise<GetMembershipData, GetMembershipVariables>;

interface GetMembershipRef {
  ...
  (dc: DataConnect, vars: GetMembershipVariables): QueryRef<GetMembershipData, GetMembershipVariables>;
}
export const getMembershipRef: GetMembershipRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMembershipRef:
```typescript
const name = getMembershipRef.operationName;
console.log(name);
```

### Variables
The `GetMembership` query requires an argument of type `GetMembershipVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetMembershipVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetMembership` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMembershipData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMembershipData {
  membership?: {
    joinedAt: TimestampString;
    chat: {
      name?: string | null;
    };
  };
}
```
### Using `GetMembership`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMembership, GetMembershipVariables } from '@dataconnect/generated';

// The `GetMembership` query requires an argument of type `GetMembershipVariables`:
const getMembershipVars: GetMembershipVariables = {
  id: ..., 
};

// Call the `getMembership()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMembership(getMembershipVars);
// Variables can be defined inline as well.
const { data } = await getMembership({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMembership(dataConnect, getMembershipVars);

console.log(data.membership);

// Or, you can use the `Promise` API.
getMembership(getMembershipVars).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

### Using `GetMembership`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMembershipRef, GetMembershipVariables } from '@dataconnect/generated';

// The `GetMembership` query requires an argument of type `GetMembershipVariables`:
const getMembershipVars: GetMembershipVariables = {
  id: ..., 
};

// Call the `getMembershipRef()` function to get a reference to the query.
const ref = getMembershipRef(getMembershipVars);
// Variables can be defined inline as well.
const ref = getMembershipRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMembershipRef(dataConnect, getMembershipVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.membership);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.membership);
});
```

## ListMyMemberships
You can execute the `ListMyMemberships` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyMemberships(options?: ExecuteQueryOptions): QueryPromise<ListMyMembershipsData, undefined>;

interface ListMyMembershipsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyMembershipsData, undefined>;
}
export const listMyMembershipsRef: ListMyMembershipsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyMemberships(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyMembershipsData, undefined>;

interface ListMyMembershipsRef {
  ...
  (dc: DataConnect): QueryRef<ListMyMembershipsData, undefined>;
}
export const listMyMembershipsRef: ListMyMembershipsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyMembershipsRef:
```typescript
const name = listMyMembershipsRef.operationName;
console.log(name);
```

### Variables
The `ListMyMemberships` query has no variables.
### Return Type
Recall that executing the `ListMyMemberships` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyMembershipsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMyMembershipsData {
  memberships: ({
    chat: {
      name?: string | null;
    };
  })[];
}
```
### Using `ListMyMemberships`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyMemberships } from '@dataconnect/generated';


// Call the `listMyMemberships()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyMemberships();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyMemberships(dataConnect);

console.log(data.memberships);

// Or, you can use the `Promise` API.
listMyMemberships().then((response) => {
  const data = response.data;
  console.log(data.memberships);
});
```

### Using `ListMyMemberships`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyMembershipsRef } from '@dataconnect/generated';


// Call the `listMyMembershipsRef()` function to get a reference to the query.
const ref = listMyMembershipsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyMembershipsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.memberships);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.memberships);
});
```

## GetMessage
You can execute the `GetMessage` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMessage(vars: GetMessageVariables, options?: ExecuteQueryOptions): QueryPromise<GetMessageData, GetMessageVariables>;

interface GetMessageRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMessageVariables): QueryRef<GetMessageData, GetMessageVariables>;
}
export const getMessageRef: GetMessageRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMessage(dc: DataConnect, vars: GetMessageVariables, options?: ExecuteQueryOptions): QueryPromise<GetMessageData, GetMessageVariables>;

interface GetMessageRef {
  ...
  (dc: DataConnect, vars: GetMessageVariables): QueryRef<GetMessageData, GetMessageVariables>;
}
export const getMessageRef: GetMessageRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMessageRef:
```typescript
const name = getMessageRef.operationName;
console.log(name);
```

### Variables
The `GetMessage` query requires an argument of type `GetMessageVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetMessageVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetMessage` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMessageData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMessageData {
  message?: {
    content: string;
    createdAt: TimestampString;
  };
}
```
### Using `GetMessage`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMessage, GetMessageVariables } from '@dataconnect/generated';

// The `GetMessage` query requires an argument of type `GetMessageVariables`:
const getMessageVars: GetMessageVariables = {
  id: ..., 
};

// Call the `getMessage()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMessage(getMessageVars);
// Variables can be defined inline as well.
const { data } = await getMessage({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMessage(dataConnect, getMessageVars);

console.log(data.message);

// Or, you can use the `Promise` API.
getMessage(getMessageVars).then((response) => {
  const data = response.data;
  console.log(data.message);
});
```

### Using `GetMessage`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMessageRef, GetMessageVariables } from '@dataconnect/generated';

// The `GetMessage` query requires an argument of type `GetMessageVariables`:
const getMessageVars: GetMessageVariables = {
  id: ..., 
};

// Call the `getMessageRef()` function to get a reference to the query.
const ref = getMessageRef(getMessageVars);
// Variables can be defined inline as well.
const ref = getMessageRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMessageRef(dataConnect, getMessageVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.message);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.message);
});
```

## ListMessagesInChat
You can execute the `ListMessagesInChat` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMessagesInChat(vars: ListMessagesInChatVariables, options?: ExecuteQueryOptions): QueryPromise<ListMessagesInChatData, ListMessagesInChatVariables>;

interface ListMessagesInChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMessagesInChatVariables): QueryRef<ListMessagesInChatData, ListMessagesInChatVariables>;
}
export const listMessagesInChatRef: ListMessagesInChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMessagesInChat(dc: DataConnect, vars: ListMessagesInChatVariables, options?: ExecuteQueryOptions): QueryPromise<ListMessagesInChatData, ListMessagesInChatVariables>;

interface ListMessagesInChatRef {
  ...
  (dc: DataConnect, vars: ListMessagesInChatVariables): QueryRef<ListMessagesInChatData, ListMessagesInChatVariables>;
}
export const listMessagesInChatRef: ListMessagesInChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMessagesInChatRef:
```typescript
const name = listMessagesInChatRef.operationName;
console.log(name);
```

### Variables
The `ListMessagesInChat` query requires an argument of type `ListMessagesInChatVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListMessagesInChatVariables {
  chatId: UUIDString;
}
```
### Return Type
Recall that executing the `ListMessagesInChat` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMessagesInChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMessagesInChatData {
  messages: ({
    content: string;
    sender: {
      displayName: string;
    };
  })[];
}
```
### Using `ListMessagesInChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMessagesInChat, ListMessagesInChatVariables } from '@dataconnect/generated';

// The `ListMessagesInChat` query requires an argument of type `ListMessagesInChatVariables`:
const listMessagesInChatVars: ListMessagesInChatVariables = {
  chatId: ..., 
};

// Call the `listMessagesInChat()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMessagesInChat(listMessagesInChatVars);
// Variables can be defined inline as well.
const { data } = await listMessagesInChat({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMessagesInChat(dataConnect, listMessagesInChatVars);

console.log(data.messages);

// Or, you can use the `Promise` API.
listMessagesInChat(listMessagesInChatVars).then((response) => {
  const data = response.data;
  console.log(data.messages);
});
```

### Using `ListMessagesInChat`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMessagesInChatRef, ListMessagesInChatVariables } from '@dataconnect/generated';

// The `ListMessagesInChat` query requires an argument of type `ListMessagesInChatVariables`:
const listMessagesInChatVars: ListMessagesInChatVariables = {
  chatId: ..., 
};

// Call the `listMessagesInChatRef()` function to get a reference to the query.
const ref = listMessagesInChatRef(listMessagesInChatVars);
// Variables can be defined inline as well.
const ref = listMessagesInChatRef({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMessagesInChatRef(dataConnect, listMessagesInChatVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.messages);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.messages);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(): MutationPromise<CreateUserData, undefined>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateUserData, undefined>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect): MutationPromise<CreateUserData, undefined>;

interface CreateUserRef {
  ...
  (dc: DataConnect): MutationRef<CreateUserData, undefined>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation has no variables.
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser } from '@dataconnect/generated';


// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser().then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef } from '@dataconnect/generated';


// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## UpdateUser
You can execute the `UpdateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUser(): MutationPromise<UpdateUserData, undefined>;

interface UpdateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<UpdateUserData, undefined>;
}
export const updateUserRef: UpdateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUser(dc: DataConnect): MutationPromise<UpdateUserData, undefined>;

interface UpdateUserRef {
  ...
  (dc: DataConnect): MutationRef<UpdateUserData, undefined>;
}
export const updateUserRef: UpdateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserRef:
```typescript
const name = updateUserRef.operationName;
console.log(name);
```

### Variables
The `UpdateUser` mutation has no variables.
### Return Type
Recall that executing the `UpdateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUser } from '@dataconnect/generated';


// Call the `updateUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUser(dataConnect);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUser().then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserRef } from '@dataconnect/generated';


// Call the `updateUserRef()` function to get a reference to the mutation.
const ref = updateUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## DeleteUser
You can execute the `DeleteUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteUser(): MutationPromise<DeleteUserData, undefined>;

interface DeleteUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
}
export const deleteUserRef: DeleteUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface DeleteUserRef {
  ...
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
}
export const deleteUserRef: DeleteUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteUserRef:
```typescript
const name = deleteUserRef.operationName;
console.log(name);
```

### Variables
The `DeleteUser` mutation has no variables.
### Return Type
Recall that executing the `DeleteUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteUserData {
  user_delete?: User_Key | null;
}
```
### Using `DeleteUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteUser } from '@dataconnect/generated';


// Call the `deleteUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteUser(dataConnect);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
deleteUser().then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

### Using `DeleteUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteUserRef } from '@dataconnect/generated';


// Call the `deleteUserRef()` function to get a reference to the mutation.
const ref = deleteUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

## CreateChat
You can execute the `CreateChat` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createChat(): MutationPromise<CreateChatData, undefined>;

interface CreateChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateChatData, undefined>;
}
export const createChatRef: CreateChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createChat(dc: DataConnect): MutationPromise<CreateChatData, undefined>;

interface CreateChatRef {
  ...
  (dc: DataConnect): MutationRef<CreateChatData, undefined>;
}
export const createChatRef: CreateChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createChatRef:
```typescript
const name = createChatRef.operationName;
console.log(name);
```

### Variables
The `CreateChat` mutation has no variables.
### Return Type
Recall that executing the `CreateChat` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateChatData {
  chat_insert: Chat_Key;
}
```
### Using `CreateChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createChat } from '@dataconnect/generated';


// Call the `createChat()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createChat();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createChat(dataConnect);

console.log(data.chat_insert);

// Or, you can use the `Promise` API.
createChat().then((response) => {
  const data = response.data;
  console.log(data.chat_insert);
});
```

### Using `CreateChat`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createChatRef } from '@dataconnect/generated';


// Call the `createChatRef()` function to get a reference to the mutation.
const ref = createChatRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createChatRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chat_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chat_insert);
});
```

## UpdateChat
You can execute the `UpdateChat` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateChat(vars: UpdateChatVariables): MutationPromise<UpdateChatData, UpdateChatVariables>;

interface UpdateChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateChatVariables): MutationRef<UpdateChatData, UpdateChatVariables>;
}
export const updateChatRef: UpdateChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateChat(dc: DataConnect, vars: UpdateChatVariables): MutationPromise<UpdateChatData, UpdateChatVariables>;

interface UpdateChatRef {
  ...
  (dc: DataConnect, vars: UpdateChatVariables): MutationRef<UpdateChatData, UpdateChatVariables>;
}
export const updateChatRef: UpdateChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateChatRef:
```typescript
const name = updateChatRef.operationName;
console.log(name);
```

### Variables
The `UpdateChat` mutation requires an argument of type `UpdateChatVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateChatVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `UpdateChat` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateChatData {
  chat_update?: Chat_Key | null;
}
```
### Using `UpdateChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateChat, UpdateChatVariables } from '@dataconnect/generated';

// The `UpdateChat` mutation requires an argument of type `UpdateChatVariables`:
const updateChatVars: UpdateChatVariables = {
  id: ..., 
};

// Call the `updateChat()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateChat(updateChatVars);
// Variables can be defined inline as well.
const { data } = await updateChat({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateChat(dataConnect, updateChatVars);

console.log(data.chat_update);

// Or, you can use the `Promise` API.
updateChat(updateChatVars).then((response) => {
  const data = response.data;
  console.log(data.chat_update);
});
```

### Using `UpdateChat`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateChatRef, UpdateChatVariables } from '@dataconnect/generated';

// The `UpdateChat` mutation requires an argument of type `UpdateChatVariables`:
const updateChatVars: UpdateChatVariables = {
  id: ..., 
};

// Call the `updateChatRef()` function to get a reference to the mutation.
const ref = updateChatRef(updateChatVars);
// Variables can be defined inline as well.
const ref = updateChatRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateChatRef(dataConnect, updateChatVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chat_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chat_update);
});
```

## DeleteChat
You can execute the `DeleteChat` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteChat(vars: DeleteChatVariables): MutationPromise<DeleteChatData, DeleteChatVariables>;

interface DeleteChatRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteChatVariables): MutationRef<DeleteChatData, DeleteChatVariables>;
}
export const deleteChatRef: DeleteChatRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteChat(dc: DataConnect, vars: DeleteChatVariables): MutationPromise<DeleteChatData, DeleteChatVariables>;

interface DeleteChatRef {
  ...
  (dc: DataConnect, vars: DeleteChatVariables): MutationRef<DeleteChatData, DeleteChatVariables>;
}
export const deleteChatRef: DeleteChatRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteChatRef:
```typescript
const name = deleteChatRef.operationName;
console.log(name);
```

### Variables
The `DeleteChat` mutation requires an argument of type `DeleteChatVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteChatVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteChat` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteChatData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteChatData {
  chat_delete?: Chat_Key | null;
}
```
### Using `DeleteChat`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteChat, DeleteChatVariables } from '@dataconnect/generated';

// The `DeleteChat` mutation requires an argument of type `DeleteChatVariables`:
const deleteChatVars: DeleteChatVariables = {
  id: ..., 
};

// Call the `deleteChat()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteChat(deleteChatVars);
// Variables can be defined inline as well.
const { data } = await deleteChat({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteChat(dataConnect, deleteChatVars);

console.log(data.chat_delete);

// Or, you can use the `Promise` API.
deleteChat(deleteChatVars).then((response) => {
  const data = response.data;
  console.log(data.chat_delete);
});
```

### Using `DeleteChat`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteChatRef, DeleteChatVariables } from '@dataconnect/generated';

// The `DeleteChat` mutation requires an argument of type `DeleteChatVariables`:
const deleteChatVars: DeleteChatVariables = {
  id: ..., 
};

// Call the `deleteChatRef()` function to get a reference to the mutation.
const ref = deleteChatRef(deleteChatVars);
// Variables can be defined inline as well.
const ref = deleteChatRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteChatRef(dataConnect, deleteChatVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.chat_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.chat_delete);
});
```

## CreateMembership
You can execute the `CreateMembership` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createMembership(vars: CreateMembershipVariables): MutationPromise<CreateMembershipData, CreateMembershipVariables>;

interface CreateMembershipRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateMembershipVariables): MutationRef<CreateMembershipData, CreateMembershipVariables>;
}
export const createMembershipRef: CreateMembershipRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createMembership(dc: DataConnect, vars: CreateMembershipVariables): MutationPromise<CreateMembershipData, CreateMembershipVariables>;

interface CreateMembershipRef {
  ...
  (dc: DataConnect, vars: CreateMembershipVariables): MutationRef<CreateMembershipData, CreateMembershipVariables>;
}
export const createMembershipRef: CreateMembershipRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createMembershipRef:
```typescript
const name = createMembershipRef.operationName;
console.log(name);
```

### Variables
The `CreateMembership` mutation requires an argument of type `CreateMembershipVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateMembershipVariables {
  chatId: UUIDString;
}
```
### Return Type
Recall that executing the `CreateMembership` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateMembershipData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateMembershipData {
  membership_insert: Membership_Key;
}
```
### Using `CreateMembership`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createMembership, CreateMembershipVariables } from '@dataconnect/generated';

// The `CreateMembership` mutation requires an argument of type `CreateMembershipVariables`:
const createMembershipVars: CreateMembershipVariables = {
  chatId: ..., 
};

// Call the `createMembership()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createMembership(createMembershipVars);
// Variables can be defined inline as well.
const { data } = await createMembership({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createMembership(dataConnect, createMembershipVars);

console.log(data.membership_insert);

// Or, you can use the `Promise` API.
createMembership(createMembershipVars).then((response) => {
  const data = response.data;
  console.log(data.membership_insert);
});
```

### Using `CreateMembership`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createMembershipRef, CreateMembershipVariables } from '@dataconnect/generated';

// The `CreateMembership` mutation requires an argument of type `CreateMembershipVariables`:
const createMembershipVars: CreateMembershipVariables = {
  chatId: ..., 
};

// Call the `createMembershipRef()` function to get a reference to the mutation.
const ref = createMembershipRef(createMembershipVars);
// Variables can be defined inline as well.
const ref = createMembershipRef({ chatId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createMembershipRef(dataConnect, createMembershipVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.membership_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.membership_insert);
});
```

## UpdateMembership
You can execute the `UpdateMembership` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateMembership(vars: UpdateMembershipVariables): MutationPromise<UpdateMembershipData, UpdateMembershipVariables>;

interface UpdateMembershipRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMembershipVariables): MutationRef<UpdateMembershipData, UpdateMembershipVariables>;
}
export const updateMembershipRef: UpdateMembershipRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateMembership(dc: DataConnect, vars: UpdateMembershipVariables): MutationPromise<UpdateMembershipData, UpdateMembershipVariables>;

interface UpdateMembershipRef {
  ...
  (dc: DataConnect, vars: UpdateMembershipVariables): MutationRef<UpdateMembershipData, UpdateMembershipVariables>;
}
export const updateMembershipRef: UpdateMembershipRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateMembershipRef:
```typescript
const name = updateMembershipRef.operationName;
console.log(name);
```

### Variables
The `UpdateMembership` mutation requires an argument of type `UpdateMembershipVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateMembershipVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `UpdateMembership` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateMembershipData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateMembershipData {
  membership_update?: Membership_Key | null;
}
```
### Using `UpdateMembership`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateMembership, UpdateMembershipVariables } from '@dataconnect/generated';

// The `UpdateMembership` mutation requires an argument of type `UpdateMembershipVariables`:
const updateMembershipVars: UpdateMembershipVariables = {
  id: ..., 
};

// Call the `updateMembership()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateMembership(updateMembershipVars);
// Variables can be defined inline as well.
const { data } = await updateMembership({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateMembership(dataConnect, updateMembershipVars);

console.log(data.membership_update);

// Or, you can use the `Promise` API.
updateMembership(updateMembershipVars).then((response) => {
  const data = response.data;
  console.log(data.membership_update);
});
```

### Using `UpdateMembership`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateMembershipRef, UpdateMembershipVariables } from '@dataconnect/generated';

// The `UpdateMembership` mutation requires an argument of type `UpdateMembershipVariables`:
const updateMembershipVars: UpdateMembershipVariables = {
  id: ..., 
};

// Call the `updateMembershipRef()` function to get a reference to the mutation.
const ref = updateMembershipRef(updateMembershipVars);
// Variables can be defined inline as well.
const ref = updateMembershipRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateMembershipRef(dataConnect, updateMembershipVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.membership_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.membership_update);
});
```

## DeleteMembership
You can execute the `DeleteMembership` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteMembership(vars: DeleteMembershipVariables): MutationPromise<DeleteMembershipData, DeleteMembershipVariables>;

interface DeleteMembershipRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteMembershipVariables): MutationRef<DeleteMembershipData, DeleteMembershipVariables>;
}
export const deleteMembershipRef: DeleteMembershipRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteMembership(dc: DataConnect, vars: DeleteMembershipVariables): MutationPromise<DeleteMembershipData, DeleteMembershipVariables>;

interface DeleteMembershipRef {
  ...
  (dc: DataConnect, vars: DeleteMembershipVariables): MutationRef<DeleteMembershipData, DeleteMembershipVariables>;
}
export const deleteMembershipRef: DeleteMembershipRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteMembershipRef:
```typescript
const name = deleteMembershipRef.operationName;
console.log(name);
```

### Variables
The `DeleteMembership` mutation requires an argument of type `DeleteMembershipVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteMembershipVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteMembership` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteMembershipData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteMembershipData {
  membership_delete?: Membership_Key | null;
}
```
### Using `DeleteMembership`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteMembership, DeleteMembershipVariables } from '@dataconnect/generated';

// The `DeleteMembership` mutation requires an argument of type `DeleteMembershipVariables`:
const deleteMembershipVars: DeleteMembershipVariables = {
  id: ..., 
};

// Call the `deleteMembership()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteMembership(deleteMembershipVars);
// Variables can be defined inline as well.
const { data } = await deleteMembership({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteMembership(dataConnect, deleteMembershipVars);

console.log(data.membership_delete);

// Or, you can use the `Promise` API.
deleteMembership(deleteMembershipVars).then((response) => {
  const data = response.data;
  console.log(data.membership_delete);
});
```

### Using `DeleteMembership`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteMembershipRef, DeleteMembershipVariables } from '@dataconnect/generated';

// The `DeleteMembership` mutation requires an argument of type `DeleteMembershipVariables`:
const deleteMembershipVars: DeleteMembershipVariables = {
  id: ..., 
};

// Call the `deleteMembershipRef()` function to get a reference to the mutation.
const ref = deleteMembershipRef(deleteMembershipVars);
// Variables can be defined inline as well.
const ref = deleteMembershipRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteMembershipRef(dataConnect, deleteMembershipVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.membership_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.membership_delete);
});
```

## SendMessage
You can execute the `SendMessage` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
sendMessage(vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface SendMessageRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
}
export const sendMessageRef: SendMessageRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
sendMessage(dc: DataConnect, vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface SendMessageRef {
  ...
  (dc: DataConnect, vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
}
export const sendMessageRef: SendMessageRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the sendMessageRef:
```typescript
const name = sendMessageRef.operationName;
console.log(name);
```

### Variables
The `SendMessage` mutation requires an argument of type `SendMessageVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SendMessageVariables {
  chatId: UUIDString;
  content: string;
}
```
### Return Type
Recall that executing the `SendMessage` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SendMessageData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SendMessageData {
  message_insert: Message_Key;
}
```
### Using `SendMessage`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, sendMessage, SendMessageVariables } from '@dataconnect/generated';

// The `SendMessage` mutation requires an argument of type `SendMessageVariables`:
const sendMessageVars: SendMessageVariables = {
  chatId: ..., 
  content: ..., 
};

// Call the `sendMessage()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await sendMessage(sendMessageVars);
// Variables can be defined inline as well.
const { data } = await sendMessage({ chatId: ..., content: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await sendMessage(dataConnect, sendMessageVars);

console.log(data.message_insert);

// Or, you can use the `Promise` API.
sendMessage(sendMessageVars).then((response) => {
  const data = response.data;
  console.log(data.message_insert);
});
```

### Using `SendMessage`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, sendMessageRef, SendMessageVariables } from '@dataconnect/generated';

// The `SendMessage` mutation requires an argument of type `SendMessageVariables`:
const sendMessageVars: SendMessageVariables = {
  chatId: ..., 
  content: ..., 
};

// Call the `sendMessageRef()` function to get a reference to the mutation.
const ref = sendMessageRef(sendMessageVars);
// Variables can be defined inline as well.
const ref = sendMessageRef({ chatId: ..., content: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = sendMessageRef(dataConnect, sendMessageVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.message_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.message_insert);
});
```

## UpdateMessage
You can execute the `UpdateMessage` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateMessage(vars: UpdateMessageVariables): MutationPromise<UpdateMessageData, UpdateMessageVariables>;

interface UpdateMessageRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMessageVariables): MutationRef<UpdateMessageData, UpdateMessageVariables>;
}
export const updateMessageRef: UpdateMessageRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateMessage(dc: DataConnect, vars: UpdateMessageVariables): MutationPromise<UpdateMessageData, UpdateMessageVariables>;

interface UpdateMessageRef {
  ...
  (dc: DataConnect, vars: UpdateMessageVariables): MutationRef<UpdateMessageData, UpdateMessageVariables>;
}
export const updateMessageRef: UpdateMessageRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateMessageRef:
```typescript
const name = updateMessageRef.operationName;
console.log(name);
```

### Variables
The `UpdateMessage` mutation requires an argument of type `UpdateMessageVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateMessageVariables {
  id: UUIDString;
  status: string;
}
```
### Return Type
Recall that executing the `UpdateMessage` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateMessageData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateMessageData {
  message_update?: Message_Key | null;
}
```
### Using `UpdateMessage`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateMessage, UpdateMessageVariables } from '@dataconnect/generated';

// The `UpdateMessage` mutation requires an argument of type `UpdateMessageVariables`:
const updateMessageVars: UpdateMessageVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateMessage()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateMessage(updateMessageVars);
// Variables can be defined inline as well.
const { data } = await updateMessage({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateMessage(dataConnect, updateMessageVars);

console.log(data.message_update);

// Or, you can use the `Promise` API.
updateMessage(updateMessageVars).then((response) => {
  const data = response.data;
  console.log(data.message_update);
});
```

### Using `UpdateMessage`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateMessageRef, UpdateMessageVariables } from '@dataconnect/generated';

// The `UpdateMessage` mutation requires an argument of type `UpdateMessageVariables`:
const updateMessageVars: UpdateMessageVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateMessageRef()` function to get a reference to the mutation.
const ref = updateMessageRef(updateMessageVars);
// Variables can be defined inline as well.
const ref = updateMessageRef({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateMessageRef(dataConnect, updateMessageVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.message_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.message_update);
});
```

## DeleteMessage
You can execute the `DeleteMessage` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteMessage(vars: DeleteMessageVariables): MutationPromise<DeleteMessageData, DeleteMessageVariables>;

interface DeleteMessageRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteMessageVariables): MutationRef<DeleteMessageData, DeleteMessageVariables>;
}
export const deleteMessageRef: DeleteMessageRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteMessage(dc: DataConnect, vars: DeleteMessageVariables): MutationPromise<DeleteMessageData, DeleteMessageVariables>;

interface DeleteMessageRef {
  ...
  (dc: DataConnect, vars: DeleteMessageVariables): MutationRef<DeleteMessageData, DeleteMessageVariables>;
}
export const deleteMessageRef: DeleteMessageRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteMessageRef:
```typescript
const name = deleteMessageRef.operationName;
console.log(name);
```

### Variables
The `DeleteMessage` mutation requires an argument of type `DeleteMessageVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteMessageVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteMessage` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteMessageData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteMessageData {
  message_delete?: Message_Key | null;
}
```
### Using `DeleteMessage`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteMessage, DeleteMessageVariables } from '@dataconnect/generated';

// The `DeleteMessage` mutation requires an argument of type `DeleteMessageVariables`:
const deleteMessageVars: DeleteMessageVariables = {
  id: ..., 
};

// Call the `deleteMessage()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteMessage(deleteMessageVars);
// Variables can be defined inline as well.
const { data } = await deleteMessage({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteMessage(dataConnect, deleteMessageVars);

console.log(data.message_delete);

// Or, you can use the `Promise` API.
deleteMessage(deleteMessageVars).then((response) => {
  const data = response.data;
  console.log(data.message_delete);
});
```

### Using `DeleteMessage`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteMessageRef, DeleteMessageVariables } from '@dataconnect/generated';

// The `DeleteMessage` mutation requires an argument of type `DeleteMessageVariables`:
const deleteMessageVars: DeleteMessageVariables = {
  id: ..., 
};

// Call the `deleteMessageRef()` function to get a reference to the mutation.
const ref = deleteMessageRef(deleteMessageVars);
// Variables can be defined inline as well.
const ref = deleteMessageRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteMessageRef(dataConnect, deleteMessageVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.message_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.message_delete);
});
```

