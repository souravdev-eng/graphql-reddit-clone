import { Resolver, Mutation, InputType, Field, Arg, Ctx, ObjectType, Query } from 'type-graphql';
import argon2 from 'argon2';

import { User } from '../entities/User';
import { MyContext } from '../types';

@InputType()
class UserNameAndPasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponses {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }

    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }

  @Mutation(() => UserResponses)
  async register(
    @Arg('options') options: UserNameAndPasswordInput,
    @Ctx() { req, em }: MyContext
  ): Promise<UserResponses> {
    if (options.username.length <= 2) {
      return {
        errors: [{ field: 'username', message: 'Invalid username' }],
      };
    }
    if (options.password.length <= 4) {
      return {
        errors: [{ field: 'password', message: 'Password must be greater than 4' }],
      };
    }

    const hashPassword = await argon2.hash(options.password);
    const user = em.create(User, { username: options.username, password: hashPassword });
    req.session.userId = user.id;
    try {
      await em.persistAndFlush(user);
    } catch (error) {
      if (error.code === '23505') {
        return {
          errors: [{ field: 'username', message: 'User name is already taken' }],
        };
      }
    }

    return { user };
  }

  @Mutation(() => UserResponses)
  async login(
    @Arg('options') options: UserNameAndPasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponses> {
    const user = await em.findOne(User, { username: options.username });

    if (!user) {
      return {
        errors: [{ field: 'username', message: 'User not found' }],
      };
    }

    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [{ field: 'password', message: 'Incorrect password' }],
      };
    }

    req.session.userId = user.id;
    return { user };
  }
}
