// // mongo.database.adapter.ts
// import { Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { Memory } from './schemas/memory.schema';
// import { IDatabaseAdapter } from './interfaces/database-adapter.interface'; // your interface
// import { v4 as uuidv4 } from 'uuid';

// @Injectable()
// export class MongoDatabaseAdapter implements IDatabaseAdapter {
//   constructor(@InjectModel(Memory.name) private memoryModel: Model<Memory>) {}

//   async init(): Promise<void> {
//     // Optional: Can be used to seed initial data or check indexes
//   }

//   async close(): Promise<void> {
//     // Mongoose connection is usually closed on app shutdown
//   }

//   async createMemory(
//     memory: Memory,
//     tableName: string,
//     unique?: boolean,
//   ): Promise<void> {
//     if (unique) {
//       const exists = await this.memoryModel.findOne({
//         roomId: memory.roomId,
//         content: memory.content,
//       });
//       if (exists) return;
//     }

//     const newMemory = new this.memoryModel(memory);
//     await newMemory.save();
//   }

//   async getMemories(params: {
//     roomId: string;
//     count?: number;
//     unique?: boolean;
//     tableName: string;
//     agentId: string;
//     start?: number;
//     end?: number;
//   }): Promise<Memory[]> {
//     const query = { roomId: params.roomId, agentId: params.agentId };

//     let dbQuery = this.memoryModel.find(query);

//     if (params.start) dbQuery = dbQuery.skip(params.start);
//     if (params.count) dbQuery = dbQuery.limit(params.count);
//     dbQuery = dbQuery.sort({ createdAt: -1 });

//     return await dbQuery.exec();
//   }

//   async getMemoryById(id: string): Promise<Memory | null> {
//     return this.memoryModel.findOne({ id }).exec();
//   }

//   async removeMemory(memoryId: string, tableName: string): Promise<void> {
//     await this.memoryModel.deleteOne({ id: memoryId }).exec();
//   }

//   async removeAllMemories(roomId: string, tableName: string): Promise<void> {
//     await this.memoryModel.deleteMany({ roomId }).exec();
//   }

//   async countMemories(
//     roomId: string,
//     unique?: boolean,
//     tableName?: string,
//   ): Promise<number> {
//     return await this.memoryModel.countDocuments({ roomId }).exec();
//   }

//   // ...implement other methods similarly
// }
