import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
    createdAt: String!
  }

  type Link {
    id: ID!
    originalUrl: String!
    shortUrl: String!
    userId: ID!
    clicks: Int!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    getUserLinks: [Link!]!
    getLinkAnalytics(linkId: ID!): LinkAnalytics!
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout(userId: String!, token: String!): Boolean!
    createLink(originalUrl: String!): Link!
    updateLink(id: ID!, originalUrl: String): Link!
    deleteLink(id: ID!): Boolean!
    updateProfile(username: String, email: String): User!
  }

  type LinkAnalytics {
  clicks: Int!
  referrers: [AnalyticItem!]!
  countries: [AnalyticItem!]!
  browsers: [AnalyticItem!]!
  operatingSystems: [AnalyticItem!]!
  deviceTypes: [AnalyticItem!]!
}

type AnalyticItem {
  name: String!
  count: Int!
}
`;