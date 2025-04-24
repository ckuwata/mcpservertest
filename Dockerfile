# Use the official Node.js image as the base image
FROM node:lts

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . ./

# Build the TypeScript code
RUN npm run build

# Expose the port the MCP Server will run on
EXPOSE 3001

# Command to run the MCP Server
CMD ["node", "build/index.js"]