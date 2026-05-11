"""add community tables

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
Create Date: 2026-04-04 19:55:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone


# revision identifiers, used by Alembic.
revision = "k0l1m2n3o4p5"
down_revision = "bbf2164e5b50"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- community_posts ---
    op.create_table(
        "community_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("author_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("likes_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comments_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_community_posts_author_id", "community_posts", ["author_id"])
    op.create_index("ix_community_posts_created_at", "community_posts", ["created_at"])

    # --- community_comments ---
    op.create_table(
        "community_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", UUID(as_uuid=True),
                  sa.ForeignKey("community_posts.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True),
                  sa.ForeignKey("community_comments.id", ondelete="CASCADE"),
                  nullable=True),
        sa.Column("likes_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_community_comments_post_id", "community_comments", ["post_id"])
    op.create_index("ix_community_comments_author_id", "community_comments", ["author_id"])

    # --- community_post_likes ---
    op.create_table(
        "community_post_likes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", UUID(as_uuid=True),
                  sa.ForeignKey("community_posts.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("post_id", "user_id", name="uq_community_post_likes_post_user"),
    )
    op.create_index("ix_community_post_likes_post_id", "community_post_likes", ["post_id"])
    op.create_index("ix_community_post_likes_user_id", "community_post_likes", ["user_id"])

    # --- Seed sample posts ---
    community_posts = sa.table(
        "community_posts",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("author_id", UUID(as_uuid=True)),
        sa.column("title", sa.String),
        sa.column("content", sa.Text),
        sa.column("tags", sa.JSON),
        sa.column("likes_count", sa.Integer),
        sa.column("comments_count", sa.Integer),
    )
    demo_author_1 = uuid.UUID("00000000-0000-0000-0000-000000000011")
    demo_author_2 = uuid.UUID("00000000-0000-0000-0000-000000000012")
    demo_author_3 = uuid.UUID("00000000-0000-0000-0000-000000000013")

    op.bulk_insert(community_posts, [
        {
            "id": uuid.UUID("00000000-0000-0000-0000-100000000001"),
            "author_id": demo_author_1,
            "title": "深度解析装饰器：从入门到精通函数式编程",
            "content": "装饰器是 Python 中最强大的特性之一。今天我想分享一下它们在底层是如何工作的，以及如何利用它们编写更简洁的代码。\n\n首先，装饰器本质上是一个接受函数作为参数并返回新函数的高阶函数。理解这一点是掌握装饰器的关键。",
            "tags": ["Python", "进阶", "教程"],
            "likes_count": 124,
            "comments_count": 3,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-100000000002"),
            "author_id": demo_author_2,
            "title": "我是如何在 5 分钟内解决\"二叉树最大深度\"问题的",
            "content": "关键在于理解递归和基准情形。这是我的思考过程和代码实现，希望能帮到正在刷题的同学。\n\n1. 先确定终止条件：空节点返回 0\n2. 分别递归计算左右子树的深度\n3. 取最大值加 1",
            "tags": ["算法", "二叉树", "递归"],
            "likes_count": 89,
            "comments_count": 2,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-100000000003"),
            "author_id": demo_author_3,
            "title": "2024 年必看的 10 个 Python 数据可视化库",
            "content": "除了 Matplotlib 和 Seaborn，还有一些新兴的库值得你关注，比如 Plotly 和 Altair。\n\nPlotly 支持交互式图表，Altair 基于声明式语法，两者各有千秋。",
            "tags": ["数据科学", "可视化", "工具库"],
            "likes_count": 256,
            "comments_count": 2,
        },
    ])

    # Seed sample comments
    community_comments = sa.table(
        "community_comments",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("post_id", UUID(as_uuid=True)),
        sa.column("author_id", UUID(as_uuid=True)),
        sa.column("content", sa.Text),
        sa.column("parent_id", UUID(as_uuid=True)),
        sa.column("likes_count", sa.Integer),
    )
    demo_commenter_1 = uuid.UUID("00000000-0000-0000-0000-000000000014")
    demo_commenter_2 = uuid.UUID("00000000-0000-0000-0000-000000000015")

    comment_1_id = uuid.UUID("00000000-0000-0000-0000-200000000001")
    comment_2_id = uuid.UUID("00000000-0000-0000-0000-200000000002")

    op.bulk_insert(community_comments, [
        {
            "id": comment_1_id,
            "post_id": uuid.UUID("00000000-0000-0000-0000-100000000001"),
            "author_id": demo_commenter_1,
            "content": "讲得很清楚，收藏了！请问有配套的练习题推荐吗？",
            "parent_id": None,
            "likes_count": 8,
        },
        {
            "id": comment_2_id,
            "post_id": uuid.UUID("00000000-0000-0000-0000-100000000001"),
            "author_id": demo_commenter_2,
            "content": "感谢楼主分享！补充一点：实际项目中也要注意性能优化方面的考量。",
            "parent_id": None,
            "likes_count": 5,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-200000000003"),
            "post_id": uuid.UUID("00000000-0000-0000-0000-100000000001"),
            "author_id": demo_commenter_1,
            "content": "同问！我也想找配套练习。",
            "parent_id": comment_1_id,
            "likes_count": 2,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-200000000004"),
            "post_id": uuid.UUID("00000000-0000-0000-0000-100000000002"),
            "author_id": demo_commenter_2,
            "content": "递归理解了之后真的是豁然开朗，感谢分享！",
            "parent_id": None,
            "likes_count": 3,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-200000000005"),
            "post_id": uuid.UUID("00000000-0000-0000-0000-100000000002"),
            "author_id": demo_commenter_1,
            "content": "BFS 方法也可以解决这个问题，层序遍历计算层数。",
            "parent_id": None,
            "likes_count": 6,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-200000000006"),
            "post_id": uuid.UUID("00000000-0000-0000-0000-100000000003"),
            "author_id": demo_commenter_1,
            "content": "Plotly 确实好用，推荐大家试试 Plotly Express！",
            "parent_id": None,
            "likes_count": 4,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-200000000007"),
            "post_id": uuid.UUID("00000000-0000-0000-0000-100000000003"),
            "author_id": demo_commenter_2,
            "content": "Altair 的语法确实简洁，做探索性分析特别方便。",
            "parent_id": None,
            "likes_count": 3,
        },
    ])


def downgrade() -> None:
    op.drop_table("community_post_likes")
    op.drop_table("community_comments")
    op.drop_table("community_posts")
