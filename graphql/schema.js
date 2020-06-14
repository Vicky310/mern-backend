const { buildSchema } = require('graphql');

module.exports = buildSchema(`
    type Product {
        _id: ID!
        title: String!
        description: String!
        price: String!
        creator: User!
        createdAt: String!
        updatedAt: String!
    }

    type User {
        _id: ID!
        name: String!
        email: String!
        password: String
        status: String!
        products: [Product!]!
    }

    type AuthData {
        token: String!
        userId: String!
    }

    type ProductData {
        products: [Product!]!
        totalProducts: Int!
    }

    input UserInputData {
        email: String!
        name: String!
        password: String!
    }

    input ProductInputData {
        title: String!
        description: String!
        price: String!
    }

    type RootQuery {
        login(email: String!, password: String!): AuthData!
        products(page: Int): ProductData!
        product(id: ID!): Product!
        user: User!
    }

    type RootMutation {
        createUser(userInput: UserInputData): User!
        createProduct(productInput: ProductInputData): Product!
        updateProduct(id: ID!, productInput: ProductInputData): Product!
        deleteProduct(id: ID!): Boolean
        updateStatus(status: String!): User!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);
