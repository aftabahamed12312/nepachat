# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateUser, useUpdateUser, useDeleteUser, useGetUser, useListUsers, useCreateChat, useUpdateChat, useDeleteChat, useGetChat, useListChats } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateUser();

const { data, isPending, isSuccess, isError, error } = useUpdateUser();

const { data, isPending, isSuccess, isError, error } = useDeleteUser();

const { data, isPending, isSuccess, isError, error } = useGetUser();

const { data, isPending, isSuccess, isError, error } = useListUsers();

const { data, isPending, isSuccess, isError, error } = useCreateChat();

const { data, isPending, isSuccess, isError, error } = useUpdateChat(updateChatVars);

const { data, isPending, isSuccess, isError, error } = useDeleteChat(deleteChatVars);

const { data, isPending, isSuccess, isError, error } = useGetChat(getChatVars);

const { data, isPending, isSuccess, isError, error } = useListChats();

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createUser, updateUser, deleteUser, getUser, listUsers, createChat, updateChat, deleteChat, getChat, listChats } from '@dataconnect/generated';


// Operation CreateUser: 
const { data } = await CreateUser(dataConnect);

// Operation UpdateUser: 
const { data } = await UpdateUser(dataConnect);

// Operation DeleteUser: 
const { data } = await DeleteUser(dataConnect);

// Operation GetUser: 
const { data } = await GetUser(dataConnect);

// Operation ListUsers: 
const { data } = await ListUsers(dataConnect);

// Operation CreateChat: 
const { data } = await CreateChat(dataConnect);

// Operation UpdateChat:  For variables, look at type UpdateChatVars in ../index.d.ts
const { data } = await UpdateChat(dataConnect, updateChatVars);

// Operation DeleteChat:  For variables, look at type DeleteChatVars in ../index.d.ts
const { data } = await DeleteChat(dataConnect, deleteChatVars);

// Operation GetChat:  For variables, look at type GetChatVars in ../index.d.ts
const { data } = await GetChat(dataConnect, getChatVars);

// Operation ListChats: 
const { data } = await ListChats(dataConnect);


```