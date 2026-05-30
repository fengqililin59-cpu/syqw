import { DataTypes, Model } from 'sequelize';

export class FlowEdge extends Model {
  static initModel(sequelize) {
    FlowEdge.init(
      {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        flow_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        source_key: { type: DataTypes.STRING(64), allowNull: false },
        target_key: { type: DataTypes.STRING(64), allowNull: false },
        branch: { type: DataTypes.STRING(20), allowNull: true },
      },
      {
        sequelize,
        modelName: 'FlowEdge',
        tableName: 'flow_edges',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
    return FlowEdge;
  }
}
