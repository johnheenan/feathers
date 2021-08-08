---
to: "<%= h.feathers.framework === 'express' ? `${h.lib}/app.ts` : null %>"
---
import compress from 'compression';
import helmet from 'helmet';

import { feathers } from '@feathersjs/feathers';
import * as express from '@feathersjs/express';
import configuration from '@feathersjs/configuration';
<% if (hasSocketio) { %>import socketio from '@feathersjs/socketio';<% } %>

import { logger } from './logger';
import services from './services';
import channels from './channels';
import { Application } from './declarations';

const app: Application = express.default(feathers());

// Load app configuration
app.configure(configuration());
app.use(helmet());
app.use(compress());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Host the public folder
app.use('/', express.static(app.get('public')));

// Configure services and real-time functionality
app.configure(express.rest());
<% if (hasSocketio) { %>app.configure(socketio());<% } %>
app.configure(services);
app.configure(channels);

// Configure a middleware for 404s and the error handler
app.use(express.notFound());
app.use(express.errorHandler({ logger }));

export { app };