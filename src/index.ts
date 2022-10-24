import express from 'express';
import 'reflect-metadata';
import redis from 'redis';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { MikroORM } from '@mikro-orm/core';
import connectRedis from 'connect-redis';
import session from 'express-session';

import { UserResolver } from './resolvers/users';
import { PostResolver } from './resolvers/post';
import microConfig from './mikro-orm.config';
import { __prod__ } from './constants';
import { MyContext } from './types';

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();

  const app = express();

  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

  app.use(
    session({
      name: 'qid',
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        sameSite: 'lax', //csrf
        secure: __prod__, // cookie only works in https
      },
      saveUninitialized: false,
      secret: 'vghgvgdvhgdhjvf',
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [UserResolver, PostResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res }),
  });

  apolloServer.applyMiddleware({ app });

  app.listen(4000, () => {
    console.log('Server started on PORT 4000');
  });
};

main()
  .then(() => {
    console.log('App running');
  })
  .catch((err) => {
    console.log(err.message);
  });
