export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const year = parseInt(searchParams.get("year"));
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    const query = { orgId };
    if (!isNaN(year)) {
      query.year = year;
    }
    const [holidays, total] = await Promise.all([
      Holiday.find(query).skip(skip).limit(limit),
      Holiday.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        holidays,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, date, year, note, orgId } = body;

    const holiday = new Holiday({
      name,
      date,
      year: year ? year : new Date().getFullYear(), // Only set year if provided
      note,
      orgId,
    });
    await holiday.save();
    return NextResponse.json("Holiday added successfully!", { status: 201 });
  } catch (error) {
    console.error("Error creating holiday:", error);
    return NextResponse.json(
      { error: "Failed to create holiday" },
      { status: 500 },
    );
  }
}
