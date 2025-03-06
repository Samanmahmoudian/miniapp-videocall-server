import { 
  ConnectedSocket, 
  MessageBody, 
  OnGatewayConnection, 
  OnGatewayDisconnect, 
  SubscribeMessage, 
  WebSocketGateway, 
  WebSocketServer 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Mutex } from 'async-mutex'; // Importing Mutex for synchronizing queue operations

let queue = new Set()
const mutex = new Mutex();



@WebSocketGateway({ cors: { origin: '*' } })
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private clients = new Map<string, Socket>();
  private pairedUser = new Map()

  async handleConnection(client: Socket) {
    const userTelegramId = String(client.handshake.query.userTelegramId);
  
    if (this.clients.has(userTelegramId)) {
      const oldClient = this.clients.get(userTelegramId);
      oldClient?.disconnect(); 
      this.clients.delete(userTelegramId);
    }

    this.clients.set(userTelegramId, client);
    console.log(`User connected: ${userTelegramId}`);
  }

  async handleDisconnect(client: Socket) {
    for (let [key, value] of this.clients.entries()) {
      if (value === client) {
        client.broadcast.emit('disconnected', key);
        queue.delete(key)
        this.clients.delete(key);
        console.log(`User disconnected: ${key}`);
        break;
      }
    }
  }

  async startNewCall(TelegramId: string) {
    if (!queue.has(TelegramId)) { 
      queue.add(TelegramId);
    }
    this.connectClients();
  }

  async connectClients() {
    while (queue.size >= 2) {
      const release = await mutex.acquire();
      try {
        const callerId = queue.values().next().value
        queue.delete(callerId)
        const calleeId = queue.values().next().value;
        queue.delete(calleeId)

        if (callerId && calleeId) {
          const callerClient = this.clients.get(callerId);
          const calleeClient = this.clients.get(calleeId);

          if (callerClient && calleeClient) {

            await Promise.all([
              callerClient.emit('caller', calleeId),
              calleeClient.emit('callee', callerId),
              this.pairedUser.set(callerId , calleeId),
              this.pairedUser.set(calleeId , callerId)
              
            ]);

            console.log(`Connected: ${callerId} with ${calleeId}`);
            release(); 
            return; 
          } else {

            if (callerId) queue.add(callerId);
            if (calleeId) queue.add(calleeId);
            console.log('Re-queuing due to invalid client(s)');
          }
        } else {
          console.log('Insufficient clients in queue to connect');
        }
      } finally {
        release();
      }
    }
  }

  @SubscribeMessage('startNewCall')
  async handleStartNewCall(@MessageBody() telegramId: string, @ConnectedSocket() client: Socket) {
    await this.startNewCall(telegramId);
  }

  @SubscribeMessage('ice')
  async handleIce(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    target?.emit('ice', message.data);
  }

  @SubscribeMessage('offer')
  async handleOffer(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    target?.emit('offer', message.data);
  }

  @SubscribeMessage('answer')
  async handleAnswer(@MessageBody() message: any, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(message.to);
    target?.emit('answer', message.data);
  }

  @SubscribeMessage('nextcall')
  async handleNextCall(@MessageBody() Id, @ConnectedSocket() client: Socket) {
    const target = this.clients.get(Id.to);
    target?.emit('nextcall', 'nextcall');

    // Check if the 'from' id is already in the queue
    if (queue.has(Id.from)) {
      queue.delete(Id.from); // Remove 'from' id from queue if already present
    }
    // Optionally: re-add the 'from' id for the next round of connections if needed
  }
}
