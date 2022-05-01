import {
  feathers, HookContext, Application as FeathersApplication
} from '@feathersjs/feathers';
import { memory, MemoryService } from '@feathersjs/memory';
import { GeneralError } from '@feathersjs/errors';

import {
  schema, resolve, Infer, resolveResult,
  queryProperty, resolveQuery, resolveData, validateData, validateQuery
} from '../src';
import { AdapterParams } from '../../memory/node_modules/@feathersjs/adapter-commons/lib';

export const userSchema = schema({
  $id: 'UserData',
  type: 'object',
  additionalProperties: false,
  required: ['email'],
  properties: {
    email: { type: 'string' },
    password: { type: 'string' }
  }
} as const);

export const userResultSchema = schema({
  $id: 'UserResult',
  type: 'object',
  additionalProperties: false,
  required: ['id', ...userSchema.definition.required],
  properties: {
    ...userSchema.definition.properties,
    id: { type: 'number' }
  }
} as const);

export type User = Infer<typeof userSchema>;
export type UserResult = Infer<typeof userResultSchema> & { name: string };

export const userDataResolver = resolve<User, HookContext<Application>>({
  schema: userSchema,
  validate: 'before',
  properties: {
    password: async () => {
      return 'hashed';
    }
  }
});

export const userResultResolver = resolve<UserResult, HookContext<Application>>({
  schema: userResultSchema,
  properties: {
    name: async (_value, user) => user.email.split('@')[0],
    password: async (value, _user, context) => {
      return context.params.provider ? undefined : value;
    }
  }
});

export const secondUserResultResolver = resolve<UserResult, HookContext<Application>>({
  schema: userResultSchema,
  properties: {
    name: async (value, user) => `${value} (${user.email})`
  }
});

export const messageSchema = schema({
  $id: 'MessageData',
  type: 'object',
  additionalProperties: false,
  required: ['text', 'userId'],
  properties: {
    text: { type: 'string' },
    userId: { type: 'number' }
  }
} as const);

export const messageResultSchema = schema({
  $id: 'MessageResult',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'user', ...messageSchema.definition.required],
  properties: {
    ...messageSchema.definition.properties,
    id: { type: 'number' },
    user: { $ref: 'UserResult' }
  }
} as const);

export type Message = Infer<typeof messageSchema>;
export type MessageResult = Infer<typeof messageResultSchema> & {
  user: User;
};

export const messageResultResolver = resolve<MessageResult, HookContext<Application>>({
  schema: messageResultSchema,
  properties: {
    user: async (_value, message, context) => {
      const { userId } = message;

      if (context.params.error === true) {
        throw new GeneralError('This is an error');
      }

      return context.app.service('users').get(userId, context.params);
    }
  }
});

export const messageQuerySchema = schema({
  $id: 'MessageQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    $limit: {
      type: 'number',
      minimum: 0,
      maximum: 100
    },
    $skip: {
      type: 'number'
    },
    $resolve: {
      type: 'array',
      items: { type: 'string' }
    },
    userId: queryProperty({
      type: 'number'
    })
  }
} as const);

export type MessageQuery = Infer<typeof messageQuerySchema>;

export const messageQueryResolver = resolve<MessageQuery, HookContext<Application>>({
  schema: messageQuerySchema,
  validate: 'before',
  properties: {
    userId: async (value, _query, context) => {
      if (context.params?.user) {
        return context.params.user.id;
      }

      return value;
    }
  }
});

interface ServiceParams extends AdapterParams {
  user?: User;
  error?: boolean;
}

type ServiceTypes = {
  users: MemoryService<UserResult, User, ServiceParams>,
  messages: MemoryService<MessageResult, Message, ServiceParams>
  paginatedMessages: MemoryService<MessageResult, Message, ServiceParams>
}
type Application = FeathersApplication<ServiceTypes>;

const app = feathers<ServiceTypes>()
  .use('users', memory({
    multi: ['create']
  }))
  .use('messages', memory())
  .use('paginatedMessages', memory({paginate: { default: 10 }}));

app.service('messages').hooks([
  validateQuery(messageQuerySchema),
  resolveQuery(messageQueryResolver),
  resolveResult(messageResultResolver)
]);

app.service('paginatedMessages').hooks([
  validateQuery(messageQuerySchema),
  resolveQuery(messageQueryResolver),
  resolveResult(messageResultResolver)
]);

app.service('users').hooks([
  resolveResult(userResultResolver, secondUserResultResolver)
]);

app.service('users').hooks({
  create: [
    validateData(userSchema),
    resolveData(userDataResolver)
  ]
});

export { app };
