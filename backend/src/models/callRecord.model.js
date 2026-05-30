/**
 * @file 通话记录模型。
 */
import { DataTypes, Model } from 'sequelize';

export class CallRecord extends Model {
  static initModel(sequelize) {
    CallRecord.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        caller_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        call_type: {
          type: DataTypes.ENUM('outbound', 'inbound', 'ai_bot'),
          allowNull: false,
          defaultValue: 'outbound',
        },
        dial_mode: {
          type: DataTypes.ENUM('phone', 'webrtc'),
          allowNull: false,
          defaultValue: 'phone',
        },
        status: {
          type: DataTypes.ENUM('initiating', 'calling', 'connected', 'completed', 'failed', 'cancelled'),
          allowNull: false,
          defaultValue: 'initiating',
        },
        customer_phone: { type: DataTypes.STRING(20), allowNull: false },
        caller_phone: { type: DataTypes.STRING(20), allowNull: true },
        duration_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        recording_url: { type: DataTypes.STRING(500), allowNull: true },
        transcript_text: { type: DataTypes.TEXT, allowNull: true },
        failure_reason: { type: DataTypes.STRING(200), allowNull: true },
        tccc_session_id: { type: DataTypes.STRING(100), allowNull: true },
        started_at: { type: DataTypes.DATE, allowNull: true },
        connected_at: { type: DataTypes.DATE, allowNull: true },
        ended_at: { type: DataTypes.DATE, allowNull: true },
      },
      { sequelize, modelName: 'CallRecord', tableName: 'call_records' },
    );
    return CallRecord;
  }
}
