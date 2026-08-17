import PageHeader from "@/app/_components/PageHeader";

function Dashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="text-center flex flex-col items-center justify-center">
          <h1>Dashboard</h1>
          <p>Welcome to the dashboard!</p>
        </div>
        <div className="mt-4">
          <p>Additional dashboard content can go here.</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
