import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function GET() {
  try {
    const supabase: SupabaseClient = await createClient();
    
    // 如果 Supabase 未設定，回傳空陣列
    if (!supabase) {
      return NextResponse.json({ items: [], message: 'Supabase 未設定，請使用本地儲存' });
    }
    
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ items: [] });
    }

    const { data, error: fetchError } = await supabase
      .from('collected_items')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      return NextResponse.json(
        { error: '無法獲取收集清單' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data });
  } catch {
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase: SupabaseClient = await createClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 未設定，請使用本地儲存' },
        { status: 503 }
      );
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { itemId, isHQ, notes } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: '缺少 itemId' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('collected_items').insert({
      user_id: user.id,
      item_id: itemId,
      is_hq: isHQ || false,
      notes: notes || null,
    });

    if (error) {
      // 如果是重複的，忽略
      if (error.code === '23505') {
        return NextResponse.json({ success: true, duplicate: true });
      }
      return NextResponse.json(
        { error: '無法新增項目' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase: SupabaseClient = await createClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 未設定，請使用本地儲存' },
        { status: 503 }
      );
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json(
        { error: '缺少 itemId' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('collected_items')
      .delete()
      .eq('user_id', user.id)
      .eq('item_id', parseInt(itemId));

    if (error) {
      return NextResponse.json(
        { error: '無法刪除項目' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
