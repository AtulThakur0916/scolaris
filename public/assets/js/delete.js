function deleteItem(url, id) {
  Swal.fire({
    title: "Are you sure?",
    text: "You won't be able to revert this!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!"
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`${url}/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        }
      })
        .then(response => response.json())
        .then(data => {
          Swal.fire({
            title: data.success ? "Deleted!" : "Error!",
            text: data.message,
            icon: data.success ? "success" : "error"
          }).then(() => {
            if (data.success) {
              location.reload(); // Reload the page after successful deletion
            }
          });
        })
        .catch(error => {
          Swal.fire("Error!", "Something went wrong.", "error");
          console.error("Error deleting item:", error);
        });
    }
  });
}
