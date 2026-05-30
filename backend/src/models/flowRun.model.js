import { DataTypes, Model } from 'sequelize';

export class FlowRun extends Model {
  static initModel(sequelize) {
    FlowRun.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        flow_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'running' },
        current_node_key: { type: DataTypes.STRING(64), allowNull: true },
        context_json: { type: DataTypes.JSON, allowNull: true },
        next_run_at: { type: DataTypes.DATE, allowNull: true },
        error_message: { type: DataTypes.STRING(500), allowNull: true },
      },
      {
        sequelize,
        modelName: 'FlowRun',
        tableName: 'flow_runs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
    return FlowRun;
  }
}
