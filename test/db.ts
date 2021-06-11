/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import mongoose from 'mongoose';
import { hash } from 'bcrypt';
import { Coach } from '../src/models/coach.model';
import authRouter from '../src/routes/coach.auth';

const request = require('supertest');

const express = require('express');

const authApp = express();

authApp.use(express.urlencoded({ extended: false }));
authApp.use('/', authRouter);

export const connectDatabase = async () => {
  await mongoose.connect(
    'mongodb://127.0.0.1:27017/jest',
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    },
    (err) => {
      if (err) {
        process.exit(1);
      }
    },
  );
};

export const clearDatabse = async () => {
  const collections = await mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    // eslint-disable-next-line no-await-in-loop
    await collection.deleteMany({});
  }
};

export const closeDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
};

export const getToken = async (tokenObj: any, done: any) => {
  hash('jest', 10, async (err, hashedPassword) => {
    if (err) {
      return err.message;
    }
    const newCoach = new Coach({
      firstName: 'jest',
      lastName: 'test',
      email: 'jest@test.net',
      password: hashedPassword,
    });
    await newCoach.save();
    const resp = await request(authApp).post('/login').type('form').send({
      email: 'jest@test.net',
      password: 'jest',
    });
    tokenObj.token.push(resp.body.accessToken);
    done();
  });
};
