# 1. Start with an official Node.js image.
# The 'slim' version is smaller and more secure.
FROM node:18-slim

# 2. Set the working directory inside the container.
WORKDIR /app

# 3. Copy the package files and install dependencies.
# This step is separated to take advantage of Docker's caching,
# so dependencies are only re-installed if package.json changes.
COPY package*.json ./
RUN npm install --production

# 4. Copy the rest of your application code.
COPY . .

# 5. Tell Fly.io what command to run when the server starts.
CMD ["npm", "start"]
